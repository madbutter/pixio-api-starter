// src/lib/storage/supabase-storage.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { MediaType } from '@/lib/constants/media';

// Upload a file to Supabase Storage
export async function uploadFile(
  userId: string,
  fileBuffer: ArrayBuffer,
  mediaType: MediaType,
  fileExtension: string,
  contentType: string
): Promise<{ success: boolean; path?: string; url?: string; error?: string }> {
  try {
    // Create a unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const fileName = `${timestamp}-${randomString}.${fileExtension}`;
    
    // Create path based on user ID and media type
    const storagePath = `${userId}/${mediaType}s/${fileName}`;
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('generated-media')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: false
      });
    
    if (uploadError) {
      throw new Error(`Storage upload error: ${uploadError.message}`);
    }
    
    // Get public URL
    const { data: publicUrlData } = supabaseAdmin
      .storage
      .from('generated-media')
      .getPublicUrl(storagePath);
    
    return {
      success: true,
      path: storagePath,
      url: publicUrlData.publicUrl
    };
  } catch (error: any) {
    console.error('File upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Delete a file from Supabase Storage
export async function deleteFile(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .storage
      .from('generated-media')
      .remove([path]);
    
    if (error) {
      throw error;
    }
    
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

// List user files
export async function listUserFiles(userId: string, mediaType?: MediaType) {
  try {
    const path = mediaType 
      ? `${userId}/${mediaType}s` 
      : `${userId}`;
    
    const { data, error } = await supabaseAdmin
      .storage
      .from('generated-media')
      .list(path, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });
    
    if (error) {
      throw error;
    }
    
    return { success: true, files: data };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
