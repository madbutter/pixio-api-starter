// supabase/functions/process-result-handler/index.ts
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// Define expected structure for metadata updates
interface MediaMetadataUpdate { run_id?: string | null; generationMode?: string | null; error?: string | null; failed_at?: string | null; final_api_status?: string | null; original_url?: string | null; file_size?: number | null; completed_at?: string | null; [key: string]: any; }

// Helper to update DB status on error
async function updateStatusToFailed(
    supabaseAdmin: SupabaseClient, mediaId: string | null, errorMessage: string, runId?: string | null
) {
    if (!mediaId) { console.error("[Process] updateStatusToFailed called without mediaId."); return; }
    try {
        const { data: existingRecord } = await supabaseAdmin.from('generated_media').select('metadata').eq('id', mediaId).single();
        let updatedMetadata: MediaMetadataUpdate = (existingRecord?.metadata && typeof existingRecord.metadata === 'object') ? { ...existingRecord.metadata } : {};
        updatedMetadata.error = errorMessage; updatedMetadata.failed_at = new Date().toISOString();
        if (runId !== undefined) updatedMetadata.run_id = runId;
        await supabaseAdmin.from('generated_media').update({ status: 'failed', metadata: updatedMetadata as any }).eq('id', mediaId);
        console.log(`[Process] Media ${mediaId} status updated to failed. Reason: ${errorMessage}`);
    } catch (e) { console.error(`[Process] Failed to update status to failed for ${mediaId}:`, e); }
}

serve(async (req: Request) => {
    console.log("[Process] Function invoked.");
    if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization');
     if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
        console.error("[Process] Unauthorized attempt.");
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    console.log("[Process] Authorization check passed.");

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
     if (!supabaseUrl) {
        console.error("[Process] Missing SUPABASE_URL env var.");
        return new Response(JSON.stringify({ error: 'Internal server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, serviceKey);
    let mediaId: string | null = null;
    let runId: string | null = null;
    // outputUrl is now extracted from the payload passed by poll-status-handler
    // let outputUrl: string | null = null;

    try {
        console.log("[Process] Attempting to parse request body...");
        let requestBody: { mediaId: string; runId: string; outputUrl: string }; // Expect outputUrl
        try {
            requestBody = await req.json();
            console.log("[Process] Request body parsed:", JSON.stringify(requestBody));
        } catch (parseError: any) {
             console.error("[Process] Failed to parse request body:", parseError);
             throw new Error(`Invalid request body: ${parseError.message}`);
        }

        mediaId = requestBody?.mediaId;
        runId = requestBody?.runId;
        const outputUrl = requestBody?.outputUrl; // Get the URL passed by the polling function

        if (!mediaId || !runId || !outputUrl) {
            console.error("[Process] Missing required payload fields.", { mediaId, runId, outputUrl });
            throw new Error("Missing required parameters (mediaId, runId, outputUrl)");
        }
        console.log(`[Process] Payload validated. Starting processing for media ${mediaId}, run ${runId}`);

        // --- Fetch Original Record Info ---
        console.log(`[Process] Fetching original record for mediaId: ${mediaId}`);
        const { data: mediaRecord, error: fetchError } = await supabaseAdmin.from('generated_media').select('user_id, media_type, metadata').eq('id', mediaId).single();
        if (fetchError || !mediaRecord) { throw new Error(`Failed to fetch original record ${mediaId}: ${fetchError?.message ?? 'Not found'}`); }
        console.log(`[Process] Fetched record for mediaId: ${mediaId}`);
        const userId = mediaRecord.user_id;
        const mediaType = mediaRecord.media_type as 'image' | 'video';
        const generationMode = (mediaRecord.metadata as any)?.generationMode;
        const existingMetadata = (mediaRecord.metadata && typeof mediaRecord.metadata === 'object' && mediaRecord.metadata !== null) ? { ...mediaRecord.metadata } : {};

        // --- Download Media ---
        // Use the outputUrl directly passed in the payload
        const remoteMediaUrl: string = outputUrl;
        let fileExtension: string; let contentType: string;

        // Determine file extension and content type based on the URL and mediaType
        const urlExtensionMatch = remoteMediaUrl.match(/\.(png|jpg|jpeg|webp|gif|mp4)$/i);
        const urlExtension = urlExtensionMatch ? urlExtensionMatch[0].toLowerCase() : null;

        switch(mediaType) {
            case 'image':
                fileExtension = urlExtension || '.png'; // Use extension from URL if available
                contentType = `image/${fileExtension.substring(1)}`;
                break;
            case 'video':
                 if (urlExtension === '.mp4') { // Prefer extension from URL
                    fileExtension = '.mp4'; contentType = 'video/mp4';
                 } else {
                    fileExtension = '.webp'; contentType = 'video/webm'; // Fallback for video
                 }
                 break;
            default:
                fileExtension = urlExtension || '.bin'; // Use URL extension or fallback
                contentType = 'application/octet-stream';
        }
        console.log(`[Process] Determined fileExtension: ${fileExtension}, contentType: ${contentType}`);
        console.log(`[Process] Downloading ${mediaType} for ${mediaId} from: ${remoteMediaUrl}`);

        const mediaResponse = await fetch(remoteMediaUrl, { headers: { 'Cache-Control': 'no-cache' } });
        if (!mediaResponse.ok) throw new Error(`Download failed (${mediaResponse.status}): ${mediaResponse.statusText}`);
        const mediaBuffer = await mediaResponse.arrayBuffer();
        if (mediaBuffer.byteLength === 0) throw new Error('Downloaded file is empty');
        console.log(`[Process] Downloaded size for ${mediaId}: ${(mediaBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

        // --- Upload to Supabase Storage ---
        const timestamp = Date.now();
        const fileName = `${timestamp}-${mediaId.substring(0, 8)}${fileExtension}`;
        const storagePath = `${userId}/${mediaType}s/${fileName}`;
        console.log(`[Process] Uploading ${mediaId} to storage: ${storagePath}`);
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage.from('generated-media').upload(storagePath, mediaBuffer, { contentType, upsert: true, cacheControl: '3600' });
        if (uploadError) throw new Error(`Storage upload error: ${uploadError.message}`);
        console.log(`[Process] Upload success for ${mediaId}: ${uploadData?.path}`);

        // --- Get Public URL ---
        const { data: publicUrlData } = supabaseAdmin.storage.from('generated-media').getPublicUrl(storagePath);
        if (!publicUrlData?.publicUrl) throw new Error('Failed to get public URL after upload.');

        // --- Update DB Record to Completed ---
        const updatePayload: { status: 'completed', media_url: string, storage_path: string, metadata: MediaMetadataUpdate } = {
             status: 'completed', media_url: publicUrlData.publicUrl, storage_path: storagePath,
             metadata: { ...existingMetadata, run_id: runId, generationMode, original_url: remoteMediaUrl, file_size: mediaBuffer.byteLength, completed_at: new Date().toISOString(), error: undefined }
        };
        console.log(`[Process] Updating final DB record for ${mediaId}`);
        const { error: finalUpdateError } = await supabaseAdmin.from('generated_media').update(updatePayload).eq('id', mediaId);
        if (finalUpdateError) { console.error(`[Process] Failed to update final DB record for ${mediaId}:`, finalUpdateError); /* Decide how to handle */ }
        else { console.log(`[Process] Media ${mediaId} processing complete and record updated.`); }

        // --- Return Success ---
        console.log(`[Process] Successfully processed ${mediaId}. Returning 200.`);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[Process] Error:', error instanceof Error ? error.stack : error);
        // Update DB status to failed using helper
        await updateStatusToFailed(supabaseAdmin, mediaId, `Processing function error: ${errorMessage}`, runId);
        console.log(`[Process] Error occurred for ${mediaId}. Returning 500.`);
        return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
