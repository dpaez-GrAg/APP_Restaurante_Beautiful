import { supabase } from "@/lib/supabase";

/**
 * Get public URL for a file in Supabase Storage
 */
export const getPublicUrl = (bucketName: string, filePath: string): string => {
  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);
  
  return data.publicUrl;
};

/**
 * Upload a file to Supabase Storage
 */
export const uploadFile = async (
  bucketName: string,
  filePath: string,
  file: File
): Promise<string> => {
  const { error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    throw new Error(`Error uploading file: ${error.message}`);
  }

  return getPublicUrl(bucketName, filePath);
};

/**
 * Delete a file from Supabase Storage
 */
export const deleteFile = async (
  bucketName: string,
  filePath: string
): Promise<void> => {
  const { error } = await supabase.storage
    .from(bucketName)
    .remove([filePath]);

  if (error) {
    throw new Error(`Error deleting file: ${error.message}`);
  }
};