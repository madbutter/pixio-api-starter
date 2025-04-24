// src/lib/actions/media.actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { useCredits } from '@/lib/credits';
import { revalidatePath } from 'next/cache';
// Import the SERVICE function, not the action itself recursively
import { checkGenerationStatus as checkGenerationStatusService, getUserMedia } from '@/lib/services/media.service';
import { MediaType, CREDIT_COSTS, GenerationResult } from '@/lib/constants/media';
import { GeneratedMedia } from '@/types/db_types';
import { supabaseAdmin } from '@/lib/supabase/admin'; // Use admin for reliable reads/updates

/**
 * Initiates media generation by creating a record and invoking the Supabase Function.
 */
export async function generateMedia(formData: FormData): Promise<{
  success: boolean;
  mediaId?: string; // Return the ID of the created record
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user || userError) {
    return { success: false, error: 'Authentication error' };
  }

  const prompt = formData.get('prompt') as string;
  const mediaType = formData.get('mediaType') as MediaType;

  if (!prompt || !mediaType) {
    return { success: false, error: 'Missing required fields' };
  }

  const creditCost = CREDIT_COSTS[mediaType];

  try {
    // 1. Check and deduct credits
    const creditSuccess = await useCredits(
      user.id,
      creditCost,
      `Generate ${mediaType}: "${prompt.slice(0, 30)}${prompt.length > 30 ? '...' : ''}"`
    );

    if (!creditSuccess) {
      return { success: false, error: 'Not enough credits' };
    }
    console.log(`Credits deducted successfully for user ${user.id}`);

    // 2. Create initial 'pending' record in DB
    // Using the user's client assuming RLS allows INSERT with status='pending'
    // If RLS blocks this, switch back to supabaseAdmin here.
    const { data: newMediaRecord, error: insertError } = await supabase
      .from('generated_media')
      .insert({
        user_id: user.id,
        prompt: prompt,
        media_type: mediaType,
        credits_used: creditCost,
        status: 'pending',
        media_url: '', // Initialize empty
        storage_path: '' // Initialize empty
      })
      .select('id') // Select only the ID
      .single();

    if (insertError || !newMediaRecord) {
      console.error("Failed to insert initial media record:", insertError);
      // TODO: Consider refunding credits here
      return { success: false, error: `Failed to create generation record: ${insertError?.message}` };
    }
    const mediaId = newMediaRecord.id;
    console.log(`Initial media record created with ID: ${mediaId}`);

    // 3. Invoke the Supabase Function asynchronously
    // IMPORTANT: Ensure the invoking user has permissions if not using admin client
    const { data: functionData, error: functionError } = await supabase.functions.invoke(
      'generate-media-handler', // Name of your deployed function
      {
        body: { prompt, mediaType, mediaId }, // Pass necessary data
      }
    );

    if (functionError) {
      console.error("Error invoking Supabase Function:", functionError);
      // Update status to failed using admin client for reliability
      await supabaseAdmin
        .from('generated_media')
        .update({ status: 'failed', metadata: { error: `Function invocation failed: ${functionError.message}` } })
        .eq('id', mediaId);
      // TODO: Consider refunding credits here
      return { success: false, error: `Failed to start generation: ${functionError.message}` };
    }

    console.log("Supabase Function invoked successfully:", functionData);

    // 4. Revalidate path immediately to show pending state in library and updated credits
    revalidatePath('/dashboard');

    // 5. Return success and the mediaId to the frontend for polling
    return {
      success: true,
      mediaId: mediaId
    };

  } catch (error: any) {
    console.error('Error in generateMedia action:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Server action called by the frontend form to poll the status of a specific media generation.
 * It reads the run_id from the database (updated by the Supabase function) and then calls the
 * checkGenerationStatus service function.
 */
export async function checkMediaStatus(mediaId: string): Promise<GenerationResult> {
  if (!mediaId) {
    return { success: false, error: "Media ID is required", status: 'failed' };
  }

  console.log(`Action: Polling status check for mediaId: ${mediaId}`);

  try {
    // Fetch the record using admin client to ensure we can read intermediate states reliably
    const { data: mediaRecord, error: fetchError } = await supabaseAdmin
      .from('generated_media')
      .select('status, metadata, media_url') // Select fields needed for response and run_id
      .eq('id', mediaId)
      .single();

    if (fetchError) {
      console.error(`Action: Error fetching media record ${mediaId}:`, fetchError);
      // Don't treat not found as a definitive failure yet, maybe record creation lagged?
      // Return a status that keeps polling for a bit.
      return { success: false, error: `Record fetch error: ${fetchError.message}`, status: 'processing' };
    }

    if (!mediaRecord) {
       console.warn(`Action: Media record ${mediaId} not found during poll.`);
       // Return a status that keeps polling for a bit
       return { success: false, error: `Media record not found: ${mediaId}`, status: 'processing' };
    }

    // If already completed or failed according to DB, return that status immediately
    if (mediaRecord.status === 'completed' || mediaRecord.status === 'failed') {
      console.log(`Action: Status for ${mediaId} from DB is final: ${mediaRecord.status}`);
      const metadata = mediaRecord.metadata as any; // Type assertion
      return {
        success: mediaRecord.status === 'completed',
        status: mediaRecord.status,
        mediaUrl: mediaRecord.media_url || undefined,
        error: mediaRecord.status === 'failed' ? (metadata?.error || 'Failed') : undefined
      };
    }

    // Extract run_id from metadata - it might not be there immediately after invoking the function
    const runId = (mediaRecord.metadata as any)?.run_id;

    if (!runId) {
      console.warn(`Action: run_id not yet found in metadata for mediaId ${mediaId}. Current DB status: ${mediaRecord.status}. Continuing poll...`);
      // Return current status from DB, keep polling
      return { success: true, status: mediaRecord.status || 'pending' };
    }

    console.log(`Action: Found run_id ${runId} for mediaId ${mediaId}. Calling service function to check API...`);

    // Call the *service function* which interacts with ComfyUI API and updates DB/Storage
    const serviceResult = await checkGenerationStatusService(mediaId, runId);

    // Revalidate the dashboard path if the service function marked it as completed/failed
    if (serviceResult.status === 'completed' || serviceResult.status === 'failed') {
      revalidatePath('/dashboard');
      console.log(`Action: Revalidated /dashboard because service reported status: ${serviceResult.status}`);
    }

    // Return the result obtained from the service function (which reflects the latest API check)
    return serviceResult;

  } catch (error: any) {
    console.error(`Action: Error in checkMediaStatus for ${mediaId}:`, error);
    // Return failed status if the action itself encounters an error
    return { success: false, error: error.message, status: 'failed' };
  }
}

// --- NEW: deleteMedia action ---
export async function deleteMedia(mediaId: string, storagePath: string | null): Promise<{ // Allow storagePath to be null
    success: boolean;
    error?: string;
  }> {
    // Only mediaId is strictly required for DB deletion
    if (!mediaId) {
      return { success: false, error: "Media ID is required." };
    }
  
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
  
    if (!user || userError) {
      return { success: false, error: 'Authentication error' };
    }
  
    console.log(`Action: Attempting to delete media ${mediaId} (path: ${storagePath || 'N/A'}) for user ${user.id}`);
  
    try {
      // 1. Verify ownership
      const { data: mediaRecord, error: fetchError } = await supabaseAdmin
        .from('generated_media')
        .select('id, user_id, storage_path') // Select storage_path again to be sure
        .eq('id', mediaId)
        .single();
  
      if (fetchError || !mediaRecord) {
        console.error(`Action: Error fetching media ${mediaId} for deletion or not found:`, fetchError);
        return { success: false, error: 'Media record not found.' };
      }
  
      if (mediaRecord.user_id !== user.id) {
        console.warn(`Action: User ${user.id} attempted to delete media ${mediaId} owned by ${mediaRecord.user_id}. Denying.`);
        return { success: false, error: 'Permission denied.' };
      }
  
      // Use the storage_path from the fetched record, which might be null/empty
      const actualStoragePath = mediaRecord.storage_path;
  
      // 2. Delete from Storage *only if path exists*
      if (actualStoragePath) {
        console.log(`Action: Deleting file from storage: ${actualStoragePath}`);
        const { error: storageError } = await supabaseAdmin
          .storage
          .from('generated-media')
          .remove([actualStoragePath]); // Pass path in an array
  
        if (storageError) {
          // Log the error but proceed to delete DB record
          console.error(`Action: Error deleting file ${actualStoragePath} from storage (continuing to delete DB record):`, storageError);
          // Optionally return error if storage deletion is critical
          // return { success: false, error: `Storage deletion failed: ${storageError.message}` };
        } else {
            console.log(`Action: Successfully deleted file ${actualStoragePath} from storage.`);
        }
      } else {
          console.log(`Action: No storage path found for media ${mediaId}, skipping storage deletion.`);
      }
  
      // 3. Delete from Database
      console.log(`Action: Deleting record from database: ${mediaId}`);
      const { error: dbError } = await supabaseAdmin
        .from('generated_media')
        .delete()
        .eq('id', mediaId);
  
      if (dbError) {
        console.error(`Action: Error deleting record ${mediaId} from database:`, dbError);
        throw new Error(`Database deletion failed: ${dbError.message}`);
      }
  
      console.log(`Action: Successfully deleted record ${mediaId} from database.`);
  
      // 4. Revalidate path so the library updates
      revalidatePath('/dashboard');
  
      return { success: true };
  
    } catch (error: any) {
      console.error(`Action: Unexpected error during media deletion for ${mediaId}:`, error);
      return { success: false, error: error.message };
    }
  }
/**
 * Fetches media items for the current user to display in the library.
 */
export async function fetchUserMedia(): Promise<{
  success: boolean;
  media: GeneratedMedia[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user || userError) {
    return { success: false, error: 'Authentication error', media: [] };
  }

  try {
    // Fetch all relevant statuses to display in the library
    const { data, error } = await supabase
      .from('generated_media')
      .select('*')
      .eq('user_id', user.id)
      // Fetch all statuses the library might display
      .in('status', ['pending', 'processing', 'completed', 'failed'])
      .order('created_at', { ascending: false })
      .limit(50); // Adjust limit as needed

    if (error) {
      throw new Error(`Failed to fetch media: ${error.message}`);
    }

    console.log(`Fetched ${data?.length || 0} media items for user ${user.id}`);
    return { success: true, media: data || [], error: undefined };
  } catch (error: any) {
    console.error('Error fetching user media:', error);
    return { success: false, error: error.message, media: [] };
  }
}
