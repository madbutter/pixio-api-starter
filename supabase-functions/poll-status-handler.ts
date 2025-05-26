// supabase/functions/poll-status-handler/index.ts
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// Define expected structure for metadata updates
interface MediaMetadataUpdate { run_id?: string | null; generationMode?: string | null; error?: string | null; failed_at?: string | null; final_api_status?: string | null; [key: string]: any; }

// Helper to update DB status on error
async function updateStatusToFailed(
    supabaseAdmin: SupabaseClient,
    mediaId: string | null,
    errorMessage: string,
    // Explicitly allow null or undefined for optional params
    runId: string | null | undefined,
    finalApiStatus: string | null | undefined
) {
    if (!mediaId) { console.error("updateStatusToFailed called without mediaId."); return; }
    try {
        const { data: existingRecord } = await supabaseAdmin.from('generated_media').select('metadata').eq('id', mediaId).single();
        let updatedMetadata: MediaMetadataUpdate = (existingRecord?.metadata && typeof existingRecord.metadata === 'object') ? { ...existingRecord.metadata } : {};
        updatedMetadata.error = errorMessage; updatedMetadata.failed_at = new Date().toISOString();
        // Check for undefined explicitly before assigning
        if (runId !== undefined) updatedMetadata.run_id = runId;
        if (finalApiStatus !== undefined) updatedMetadata.final_api_status = finalApiStatus;
        await supabaseAdmin.from('generated_media').update({ status: 'failed', metadata: updatedMetadata as any }).eq('id', mediaId);
        console.log(`[Poll] Media ${mediaId} status updated to failed. Reason: ${errorMessage}`);
    } catch (e) { console.error(`[Poll] Failed to update status to failed for ${mediaId}:`, e); }
}

// Helper to invoke the next function asynchronously
function invokeFunctionAsync(
    functionName: string,
    payload: { mediaId: string; [key: string]: any }, // Requires mediaId, allows others
    serviceKey: string,
    supabaseUrl: string
) {
    console.log(`[Poll] Invoking ${functionName} asynchronously for mediaId: ${payload.mediaId}`);
    fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify(payload),
    }).then(response => {
        if (!response.ok) { console.error(`[Poll] Async invocation of ${functionName} failed with status ${response.status}`); }
        else { console.log(`[Poll] Async invocation of ${functionName} acknowledged.`); }
    }).catch(error => { console.error(`[Poll] Error during async invocation of ${functionName}:`, error); });
}


serve(async (req: Request) => {
    if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization');
    if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
        console.error("[Poll] Unauthorized attempt.");
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const comfyApiKey = Deno.env.get('COMFY_DEPLOY_API_KEY');
    if (!supabaseUrl || !comfyApiKey) {
        console.error("[Poll] Missing SUPABASE_URL or COMFY_DEPLOY_API_KEY env vars.");
        return new Response(JSON.stringify({ error: 'Internal server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, serviceKey);
    let mediaId: string | null = null;
    let runId: string | null = null;
    let currentApiStatus: string | null = null;

    try {
        const { mediaId: reqMediaId, runId: reqRunId, attempt = 1 }: { mediaId: string; runId: string; attempt?: number } = await req.json();
        mediaId = reqMediaId; runId = reqRunId; // Assign validated values
        if (!mediaId || !runId) { throw new Error("Missing mediaId or runId in request body"); }

        const maxAttempts = 120;
        console.log(`[Poll] Attempt ${attempt}/${maxAttempts} for media ${mediaId}, run ${runId}`);

        const statusResponse = await fetch(`https://api.myapps.ai/api/run?run_id=${runId}`, { method: "GET", headers: { "Authorization": `Bearer ${comfyApiKey}` } });

        if (!statusResponse.ok) {
            console.error(`[Poll] API status check failed (Attempt ${attempt}): ${statusResponse.status}`);
            if (attempt < maxAttempts) {
                // Use non-null assertion as mediaId/runId are validated above
                setTimeout(() => { invokeFunctionAsync('poll-status-handler', { mediaId: mediaId!, runId: runId!, attempt: attempt + 1 }, serviceKey, supabaseUrl); }, 15000);
                return new Response(JSON.stringify({ success: true, status: 'processing', message: 'API check failed, retrying...' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            } else { throw new Error(`Polling API failed ${maxAttempts} times.`); }
        }

        const output = await statusResponse.json();
        currentApiStatus = output.status || 'unknown';
        console.log(`[Poll] API Status for run ${runId}: ${currentApiStatus}`);

        if (currentApiStatus === 'success' || currentApiStatus === 'complete') {
            const outputUrl = output?.outputs?.[0]?.data?.images?.[0]?.url;
            if (!outputUrl) { throw new Error('Success reported by API but no output file found at expected path.'); }
            // Use non-null assertion as mediaId/runId are validated above
            invokeFunctionAsync('process-result-handler', { mediaId: mediaId!, runId: runId!, outputUrl }, serviceKey, supabaseUrl);
            return new Response(JSON.stringify({ success: true, status: 'processing_result' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

        } else if (currentApiStatus === 'failed') {
            const errorMsg = output?.error || 'Generation failed according to API';
            // Use non-null assertion as mediaId/runId are validated above
            // currentApiStatus is guaranteed string 'failed' here
            await updateStatusToFailed(supabaseAdmin, mediaId!, errorMsg, runId!, currentApiStatus);
            return new Response(JSON.stringify({ success: true, status: 'failed', error: errorMsg }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

        } else if (currentApiStatus && ['processing', 'not-started', 'running', 'uploading', 'queued'].includes(currentApiStatus)) {
            if (attempt < maxAttempts) {
                 // Use non-null assertion as mediaId/runId are validated above
                setTimeout(() => { invokeFunctionAsync('poll-status-handler', { mediaId: mediaId!, runId: runId!, attempt: attempt + 1 }, serviceKey, supabaseUrl); }, 10000);
                return new Response(JSON.stringify({ success: true, status: 'processing', message: `Attempt ${attempt} processing, scheduled next check.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            } else { throw new Error(`Polling timed out after ${maxAttempts} attempts.`); }
        } else { throw new Error(`Unknown API status received: ${currentApiStatus}`); }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Poll] Error processing mediaId ${mediaId}, runId ${runId}:`, error);
        // Pass currentApiStatus (which could be null)
        await updateStatusToFailed(supabaseAdmin, mediaId, `Polling function error: ${errorMessage}`, runId, currentApiStatus);
        return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
