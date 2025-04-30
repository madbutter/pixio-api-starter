// supabase/functions/generate-media-handler/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
const DEPLOYMENT_IDS = {
  image: '8f96cb86-5cbb-4ad0-9837-8a79eeb5103a',
  video: 'd07cf1d5-412c-4270-b925-ffd6416abd1c'
};
// Utility to delay execution
const delay = (ms)=>new Promise((resolve)=>setTimeout(resolve, ms));
serve(async (req)=>{
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let mediaId = null; // Keep track of mediaId for error handling
  try {
    // --- Authentication & Input Validation ---
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')
        }
      }
    });
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    const userId = user.id;
    const body = await req.json();
    const { prompt, mediaType } = body;
    mediaId = body.mediaId; // Assign mediaId here
    if (!prompt || !mediaType || !mediaId || ![
      'image',
      'video'
    ].includes(mediaType)) {
      return new Response(JSON.stringify({
        error: 'Missing or invalid parameters'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    console.log(`Function received: userId=${userId}, mediaId=${mediaId}, type=${mediaType}`);
    // Use Service Role Key for admin operations
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // --- Update Status to Processing ---
    // Ensure record exists before proceeding
    const { error: initialUpdateError } = await supabaseAdmin.from('generated_media').update({
      status: 'processing'
    }).eq('id', mediaId).eq('user_id', userId); // Ensure we only update the correct user's record
    if (initialUpdateError) {
      console.error(`Error updating initial status for mediaId ${mediaId}:`, initialUpdateError);
      // Decide if this is critical. Maybe the record wasn't created properly?
      throw new Error(`Failed to set initial processing status: ${initialUpdateError.message}`);
    }
    console.log(`Media record ${mediaId} status set to processing.`);
    // --- Trigger ComfyUI API ---
    const deploymentId = DEPLOYMENT_IDS[mediaType];
    const comfyApiKey = Deno.env.get('COMFY_DEPLOY_API_KEY');
    if (!comfyApiKey) {
      throw new Error("COMFY_DEPLOY_API_KEY environment variable not set.");
    }
    const triggerResponse = await fetch("https://api.myapps.ai/api/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${comfyApiKey}`
      },
      body: JSON.stringify({
        deployment_id: deploymentId,
        inputs: {
          prompt
        }
      })
    });
    if (!triggerResponse.ok) {
      const errorBody = await triggerResponse.text();
      console.error(`ComfyUI trigger failed: ${triggerResponse.status} ${triggerResponse.statusText}`, errorBody);
      throw new Error(`ComfyUI trigger failed: ${triggerResponse.statusText}`);
    }
    const triggerResult = await triggerResponse.json();
    const run_id = triggerResult.run_id;
    if (!run_id) {
      throw new Error('ComfyUI did not return a run_id');
    }
    console.log(`ComfyUI run started: ${run_id}`);
    // Update DB with run_id
    const { error: runIdUpdateError } = await supabaseAdmin.from('generated_media').update({
      metadata: {
        run_id
      }
    }).eq('id', mediaId);
    if (runIdUpdateError) {
      console.error(`Error updating record ${mediaId} with run_id ${run_id}:`, runIdUpdateError);
    // Continue processing, but log the error
    }
    // --- Polling for Result ---
    let currentStatus = 'processing';
    let finalOutput = null;
    const maxAttempts = 90; // ~7.5 minutes timeout (90 * 5s)
    let attempts = 0;
    let consecutiveApiErrors = 0;
    const maxConsecutiveApiErrors = 10; // Give up polling if API fails 5 times in a row
    while([
      'processing',
      'not-started',
      'running',
      'uploading',
      'queued'
    ].includes(currentStatus) && attempts < maxAttempts){
      attempts++;
      console.log(`Polling attempt ${attempts}/${maxAttempts} for run ${run_id}. Current status: ${currentStatus}`);
      await delay(10000); // Wait 5 seconds
      try {
        const statusResponse = await fetch(`https://api.myapps.ai/api/run?run_id=${run_id}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${comfyApiKey}`
          }
        });
        if (!statusResponse.ok) {
          consecutiveApiErrors++;
          console.error(`Polling API failed (attempt ${attempts}, consecutive errors ${consecutiveApiErrors}): ${statusResponse.status} ${statusResponse.statusText}`);
          if (consecutiveApiErrors >= maxConsecutiveApiErrors) {
            currentStatus = 'failed'; // Mark as failed if API is consistently unavailable
            finalOutput = {
              error: `Polling API failed ${maxConsecutiveApiErrors} consecutive times.`
            };
            break; // Exit loop
          }
          continue; // Skip to next attempt if within error threshold
        }
        // Reset consecutive error count on success
        consecutiveApiErrors = 0;
        finalOutput = await statusResponse.json();
        currentStatus = finalOutput.status || 'unknown'; // Default to 'unknown' if status is missing
        console.log(`Status received for run ${run_id}: ${currentStatus}`);
        // Exit loop immediately if failed
        if (currentStatus === 'failed') {
          break;
        }
      } catch (pollError) {
        consecutiveApiErrors++;
        console.error(`Network error during polling attempt ${attempts} (consecutive errors ${consecutiveApiErrors}):`, pollError.message);
        if (consecutiveApiErrors >= maxConsecutiveApiErrors) {
          currentStatus = 'failed'; // Mark as failed after too many network errors
          finalOutput = {
            error: `Polling network error ${maxConsecutiveApiErrors} consecutive times: ${pollError.message}`
          };
          break; // Exit loop
        }
      // Continue polling if within error threshold
      }
    } // End of while loop
    // --- Handle Final Status ---
    console.log(`Polling finished after ${attempts} attempts. Final status: ${currentStatus}`);
    if (currentStatus === 'success' || currentStatus === 'complete') {
      const fileExtension = mediaType === 'image' ? '.png' : '.webp';
      // Ensure the URL pattern matches exactly what ComfyDeploy provides
      const mediaUrl = `https://comfy-deploy.nyc3.cdn.digitaloceanspaces.com/outputs/runs/${run_id}/ComfyUI_00001_${fileExtension}`;
      console.log(`Downloading from ${mediaUrl}`);
      const mediaResponse = await fetch(mediaUrl, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (!mediaResponse.ok) throw new Error(`Failed to download media (${mediaResponse.status}): ${mediaResponse.statusText}`);
      const mediaBuffer = await mediaResponse.arrayBuffer();
      if (mediaBuffer.byteLength === 0) throw new Error('Downloaded file is empty');
      console.log(`Downloaded media size: ${(mediaBuffer.byteLength / 1024).toFixed(2)} KB`);
      const timestamp = Date.now();
      const fileName = `${timestamp}-${mediaId.substring(0, 8)}${fileExtension}`;
      const storagePath = `${userId}/${mediaType}s/${fileName}`;
      const contentType = mediaType === 'image' ? 'image/png' : 'video/webp'; // Use correct webp type
      console.log(`Uploading to storage: ${storagePath}`);
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage.from('generated-media').upload(storagePath, mediaBuffer, {
        contentType,
        upsert: true,
        cacheControl: '3600'
      });
      if (uploadError) throw new Error(`Storage upload error: ${uploadError.message}`);
      console.log(`Successfully uploaded to storage: ${uploadData?.path}`);
      const { data: publicUrlData } = supabaseAdmin.storage.from('generated-media').getPublicUrl(storagePath);
      const { error: finalUpdateError } = await supabaseAdmin.from('generated_media').update({
        status: 'completed',
        media_url: publicUrlData.publicUrl,
        storage_path: storagePath,
        metadata: {
          ...finalOutput?.metadata || {},
          run_id,
          original_url: mediaUrl,
          file_size: mediaBuffer.byteLength,
          completed_at: new Date().toISOString()
        }
      }).eq('id', mediaId);
      if (finalUpdateError) {
        console.error(`Failed to update final record ${mediaId}:`, finalUpdateError);
      // Log error but function technically succeeded in generating
      } else {
        console.log(`Media ${mediaId} completed successfully and record updated.`);
      }
    } else {
      const errorMessage = currentStatus === 'failed' ? finalOutput?.error || 'Generation failed' : attempts >= maxAttempts ? 'Generation timed out' : `Generation stopped with unexpected status: ${currentStatus}`;
      console.error(`Generation failed or timed out for run ${run_id}: ${errorMessage}`);
      const { error: failUpdateError } = await supabaseAdmin.from('generated_media').update({
        status: 'failed',
        metadata: {
          run_id,
          error: errorMessage,
          final_api_status: currentStatus,
          failed_at: new Date().toISOString()
        }
      }).eq('id', mediaId);
      if (failUpdateError) {
        console.error(`Failed to update record ${mediaId} to failed status:`, failUpdateError);
      }
    }
    // --- Return Success (Function execution completed, background task finished) ---
    return new Response(JSON.stringify({
      success: true,
      finalStatus: currentStatus
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Supabase Function Error:', error.message);
    // Attempt to update DB record to failed if possible and mediaId is known
    if (mediaId) {
      try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        await supabaseAdmin.from('generated_media').update({
          status: 'failed',
          metadata: {
            error: `Function error: ${error.message}`
          }
        }).eq('id', mediaId);
      } catch (updateError) {
        console.error(`Failed to update status to failed on error for mediaId ${mediaId}:`, updateError);
      }
    }
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
