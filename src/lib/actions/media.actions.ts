// src/lib/actions/media.actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { useCredits } from '@/lib/credits';
import { revalidatePath } from 'next/cache';
// We will NOT import the checkGenerationStatus service function here anymore.
// It is ONLY called by the Edge Function.
// import { checkGenerationStatus as checkGenerationStatusService } from '@/lib/services/media.service';
import { MediaType, CREDIT_COSTS, GenerationResult } from '@/lib/constants/media';
import { GeneratedMedia } from '@/types/db_types';
import { supabaseAdmin } from '@/lib/supabase/admin'; // Use admin for reliable reads/updates

/**
 * Initiates media generation by deducting credits, creating a pending record,
 * and asynchronously invoking the Supabase Function.
 * Returns the ID of the pending record immediately.
 */
export async function generateMedia(formData: FormData): Promise<{
  success: boolean;
  mediaId?: string; // Return the ID of the created record
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user || userError) {
    console.error("generateMedia: Authentication error for user", userError);
    return { success: false, error: 'Authentication error' };
  }

  const prompt = formData.get('prompt') as string;
  const mediaType = formData.get('mediaType') as MediaType;

  if (!prompt || !mediaType) {
    console.error("generateMedia: Missing prompt or mediaType");
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
      console.log(`generateMedia: Not enough credits for user ${user.id}`);
      return { success: false, error: 'Not enough credits' };
    }
    console.log(`generateMedia: Credits deducted successfully for user ${user.id}`);

    // 2. Create initial 'pending' record in DB
    // Use the user's client for RLS check, or admin if RLS is complex.
    // Using user client here assumes RLS allows INSERT with status='pending'
    const { data: newMediaRecord, error: insertError } = await supabase
      .from('generated_media')
      .insert({
        user_id: user.id,
        prompt: prompt,
        media_type: mediaType,
        credits_used: creditCost,
        status: 'pending', // Initial status
        media_url: '', // Initialize empty
        storage_path: '' // Initialize empty
      })
      .select('id') // Select only the ID
      .single();

    if (insertError || !newMediaRecord) {
      console.error("generateMedia: Failed to insert initial media record:", insertError);
      // TODO: Consider refunding credits here if DB insert fails after deduction
      return { success: false, error: `Failed to create generation record: ${insertError?.message}` };
    }
    const mediaId = newMediaRecord.id;
    console.log(`generateMedia: Initial media record created with ID: ${mediaId}`);

    // 3. Invoke the Supabase Function asynchronously
    // The function will handle triggering ComfyDeploy and updating the DB record.
    // We do NOT wait for the function to complete here.
    // Pass the user's JWT so the function can authenticate as the user for RLS/ownership checks
    const { data: functionData, error: functionError } = await supabase.functions.invoke(
      'generate-media-handler', // Name of your deployed function
      {
        body: { prompt, mediaType, mediaId, userId: user.id }, // Pass necessary data including userId
      }
    );

    if (functionError) {
      console.error("generateMedia: Error invoking Supabase Function:", functionError);
      // Update status to failed using admin client for reliability
      await supabaseAdmin
        .from('generated_media')
        .update({ status: 'failed', metadata: { error: `Function invocation failed: ${functionError.message}` } })
        .eq('id', mediaId);
      // TODO: Consider refunding credits here if function invocation fails
      return { success: false, error: `Failed to start generation process: ${functionError.message}` };
    }

    console.log("generateMedia: Supabase Function invoked successfully:", functionData);

    // 4. Revalidate path immediately to show the pending state in the library and updated credits
    revalidatePath('/dashboard'); // Revalidate the dashboard page

    // 5. Return success and the mediaId immediately
    return {
      success: true,
      mediaId: mediaId // Return the ID so the frontend can poll for it
    };

  } catch (error: any) {
    console.error('generateMedia: Unexpected error:', error);
    return { success: false, error: error.message };
  }
}


/**
 * Server action called by the frontend component to poll the status of a specific
 * media generation by READING the record directly from the database.
 * This action should be fast as it only queries the DB.
 */
export async function pollMediaStatus(mediaId: string): Promise<GenerationResult> {
  if (!mediaId) {
    console.error("pollMediaStatus: Media ID is required");
    return { success: false, error: "Media ID is required", status: 'failed' };
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user || userError) {
    console.error("pollMediaStatus: Authentication error for user", userError);
    return { success: false, error: 'Authentication error', status: 'failed' };
  }

  // console.log(`pollMediaStatus: Fetching status for mediaId: ${mediaId} for user ${user.id}`); // Avoid excessive logging

  try {
    // Fetch the record using the user's client (RLS should allow this).
    // We are ONLY reading the database here. The Edge Function updates it.
    const { data: mediaRecord, error: fetchError } = await supabase
      .from('generated_media')
      .select('status, metadata, media_url')
      .eq('id', mediaId)
      .eq('user_id', user.id) // Ensure user owns the record
      .single();

    if (fetchError || !mediaRecord) {
      // This could happen if the record was somehow deleted or doesn't belong to the user.
      // Treat this as a failure for the polling process.
      console.error(`pollMediaStatus: Error fetching media record ${mediaId} or not found for user ${user.id}:`, fetchError);
      return { success: false, error: `Media record not found or unauthorized: ${fetchError?.message}`, status: 'failed' };
    }

    // console.log(`pollMediaStatus: Status for ${mediaId} from DB: ${mediaRecord.status}`); // Avoid excessive logging

    // Return the status and URL directly from the database record
    const metadata = mediaRecord.metadata as any; // Type assertion

    return {
      success: mediaRecord.status === 'completed', // Success only if completed
      status: mediaRecord.status || 'unknown', // Default to 'unknown' if status is null
      mediaUrl: mediaRecord.media_url || undefined, // Include URL if available
      error: mediaRecord.status === 'failed' ? (metadata?.error || 'Failed') : undefined // Include error if failed
    };

  } catch (error: any) {
    console.error(`pollMediaStatus: Unexpected error for ${mediaId}:`, error);
    // Return failed status if the action itself encounters an unexpected error
    return { success: false, error: error.message, status: 'failed' };
  }
}


// --- deleteMedia action (No changes needed) ---
export async function deleteMedia(mediaId: string, storagePath: string | null): Promise<{
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

  console.log(`fetchUserMedia: Fetching media for user ${user.id}`);

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
      console.error("fetchUserMedia: Database fetch error:", error);
      throw new Error(`Failed to fetch media: ${error.message}`);
    }

    console.log(`fetchUserMedia: Fetched ${data?.length || 0} media items for user ${user.id}`);
    return { success: true, media: data || [], error: undefined };
  } catch (error: any) {
    console.error('fetchUserMedia: Unexpected error:', error);
    return { success: false, error: error.message, media: [] };
  }
}

