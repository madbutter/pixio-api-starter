// supabase/functions/generate-media-handler/index.ts
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const DEPLOYMENT_IDS = {
  image: '8f96cb86-5cbb-4ad0-9837-8a79eeb5103a',
  video: 'd07cf1d5-412c-4270-b925-ffd6416abd1c',
  firstLastFrameVideo: '8c463102-0525-4cf1-8535-731fee0f93b4',
};
type GenerationMode = keyof typeof DEPLOYMENT_IDS;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};


async function updateStatusOnFunctionError(
    supabaseAdmin: SupabaseClient, mediaId: string | null, errorMessage: string
) {
    if (!mediaId) return;
    try {
        await supabaseAdmin.from('generated_media').update({
            status: 'failed',
            metadata: { error: `Function initiation failed: ${errorMessage}` }
        }).eq('id', mediaId);
        console.log(`[Generate] Media ${mediaId} status updated to failed due to function error.`);
    } catch (updateError) {
        console.error(`[Generate] Failed to update status to failed on function error for ${mediaId}:`, updateError);
    }
}

function invokePollingFunctionAsync(
    payload: { mediaId: string; runId: string; attempt: number; [key: string]: any },
    serviceKey: string, supabaseUrl: string
) {
    console.log(`[Generate] Invoking poll-status-handler asynchronously for mediaId: ${payload.mediaId}`);
    fetch(`${supabaseUrl}/functions/v1/poll-status-handler`, {
        method: 'POST',
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify(payload),
    }).then(response => {
        if (!response.ok) { console.error(`[Generate] Async invocation of poll-status-handler failed with status ${response.status}`); }
        else { console.log(`[Generate] Async invocation of poll-status-handler acknowledged.`); }
    }).catch(error => { console.error(`[Generate] Error during async invocation of poll-status-handler:`, error); });
}


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }

  let mediaId: string | null = null;
  let generationMode: GenerationMode | null = null;
  let runId: string | null = null;

  const supabaseAdmin: SupabaseClient = createClient( Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' );
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  try {
    if (!supabaseUrl || !serviceKey) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");

    const supabaseClient: SupabaseClient = createClient( Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: req.headers.get('Authorization')! } } } );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');
    const userId = user.id;

    const body = await req.json();
    const { prompt, mediaType, startImageUrl, endImageUrl }: { prompt: string; mediaType: string; generationMode: GenerationMode; mediaId: string; startImageUrl?: string; endImageUrl?: string; } = body;
    mediaId = body.mediaId; generationMode = body.generationMode;

    // Log the type of generationMode received
    console.log(`[Generate] Received generationMode: ${generationMode} (Type: ${typeof generationMode})`);

    if (!prompt || !mediaType || !generationMode || !mediaId || !(generationMode in DEPLOYMENT_IDS)) { throw new Error(`Missing or invalid parameters. Mode: ${generationMode}`); }
    if (generationMode === 'firstLastFrameVideo' && (!startImageUrl || !endImageUrl)) { throw new Error('Missing start or end image URL for firstLastFrameVideo mode'); }
    console.log(`[Generate] Validated: userId=${userId}, mediaId=${mediaId}, mode=${generationMode}`);

    const { error: initialUpdateError } = await supabaseAdmin.from('generated_media').update({ status: 'processing' }).eq('id', mediaId).eq('user_id', userId);
    if (initialUpdateError) console.warn(`[Generate] Warn: Failed to set initial processing status: ${initialUpdateError.message}`);
    else console.log(`[Generate] Media record ${mediaId} status confirmed/set to processing.`);

    // Ensure generationMode is a valid key before accessing DEPLOYMENT_IDS
    if (!(generationMode in DEPLOYMENT_IDS)) {
        throw new Error(`Invalid generationMode received: ${generationMode}`);
    }
    const deploymentId = DEPLOYMENT_IDS[generationMode]; // Now safe to access

    const comfyApiKey = Deno.env.get('COMFY_DEPLOY_API_KEY');
    if (!comfyApiKey) throw new Error("COMFY_DEPLOY_API_KEY environment variable not set.");

    let apiInputs: Record<string, any>;
    if (generationMode === 'firstLastFrameVideo') {
        apiInputs = { prompt: prompt, start_image: startImageUrl!, end_image: endImageUrl! }; // Assert non-null
    } else {
        apiInputs = { prompt: prompt };
    }

    const requestBody = { deployment_id: deploymentId, inputs: apiInputs };
    console.log(`[Generate] Triggering Pixio API: POST https://api.myapps.ai/api/run`);
    console.log(`[Generate] Using Deployment ID: ${deploymentId}`);
    console.log(`[Generate] Using API Key: Bearer ${comfyApiKey ? comfyApiKey.substring(0, 5) + '...' : 'MISSING!'}`);
    console.log(`[Generate] Request Body: ${JSON.stringify(requestBody)}`);

    const triggerResponse = await fetch("https://api.myapps.ai/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${comfyApiKey}` },
      body: JSON.stringify(requestBody),
    });

    console.log(`[Generate] Pixio API Response Status: ${triggerResponse.status} ${triggerResponse.statusText}`);

    if (!triggerResponse.ok) {
      const errorBody = await triggerResponse.text();
      console.error(`[Generate] Pixio API Error Body: ${errorBody}`);
      throw new Error(`ComfyUI trigger failed: ${triggerResponse.status} ${triggerResponse.statusText} - ${errorBody}`);
    }

    const triggerResult = await triggerResponse.json();
    runId = triggerResult.run_id;
    if (!runId) throw new Error('ComfyUI did not return a run_id');
    console.log(`[Generate] ComfyUI run started: ${runId}`);

    // Update DB with run_id and generationMode
    const { data: metaRecord, error: fetchMetaError } = await supabaseAdmin.from('generated_media').select('metadata').eq('id', mediaId).single();
    let metadataToUpdate: Record<string, any> = {};
    if (!fetchMetaError && metaRecord?.metadata && typeof metaRecord.metadata === 'object' && metaRecord.metadata !== null) { metadataToUpdate = { ...metaRecord.metadata }; }
    metadataToUpdate.run_id = runId; metadataToUpdate.generationMode = generationMode;
    const { error: runIdUpdateError } = await supabaseAdmin.from('generated_media').update({ metadata: metadataToUpdate }).eq('id', mediaId);
    if (runIdUpdateError) console.error(`[Generate] Error updating record ${mediaId} with run_id ${runId}:`, runIdUpdateError);
    else console.log(`[Generate] Updated record ${mediaId} with run_id.`);

    // Asynchronously Invoke Polling Function
    invokePollingFunctionAsync({ mediaId, runId, attempt: 1 }, serviceKey, supabaseUrl);

    // Return Success Immediately
    console.log(`[Generate] Successfully initiated generation for ${mediaId}. Returning.`);
    return new Response(JSON.stringify({ success: true, runId: runId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Generate] Error:', error instanceof Error ? error.stack : error);
    if (mediaId) { await updateStatusOnFunctionError(supabaseAdmin, mediaId, `Function error: ${errorMessage}`); }
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
