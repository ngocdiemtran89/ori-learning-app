import { supabase } from './client';

export const TOEIC_MEDIA_BUCKET = 'toeic-media';

// 10MB for image, 50MB for audio (Supabase Free plan; increase after plan upgrade)
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_SIZE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/x-m4a'];

export interface UploadMediaResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * Validates a file before upload
 */
export function validateMediaFile(file: File, type: 'image' | 'audio'): { isValid: boolean; error?: string } {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (type === 'image') {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
      return { isValid: false, error: 'Định dạng ảnh không hợp lệ (chỉ hỗ trợ JPG, PNG, WEBP).' };
    }
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      return { isValid: false, error: 'Phần mở rộng ảnh không hợp lệ (chỉ hỗ trợ .jpg, .jpeg, .png, .webp).' };
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return { isValid: false, error: 'Dung lượng ảnh vượt quá 10MB.' };
    }
  } else {
    if (!ALLOWED_AUDIO_MIME_TYPES.includes(file.type)) {
      return { isValid: false, error: 'Định dạng audio không hợp lệ (chỉ hỗ trợ MP3, M4A, WAV, OGG).' };
    }
    if (!['mp3', 'm4a', 'wav', 'ogg'].includes(ext)) {
      return { isValid: false, error: 'Phần mở rộng audio không hợp lệ (chỉ hỗ trợ .mp3, .m4a, .wav, .ogg).' };
    }
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      return { isValid: false, error: 'Dung lượng audio vượt quá 50MB.' };
    }
  }
  return { isValid: true };
}

/**
 * Normalizes file extension for a given file type
 */
function getNormalizedExtension(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'jpg') return 'jpeg';
  if (ext === 'm4a') return 'm4a'; // M4A is often audio/mp4
  return ext;
}

/**
 * Helper to upload a file to toeic-media bucket
 */
export async function uploadToeicMedia(pathPrefix: string, file: File, type: 'image' | 'audio'): Promise<UploadMediaResult> {
  const validation = validateMediaFile(file, type);
  if (!validation.isValid) {
    return { success: false, error: validation.error };
  }

  const ext = getNormalizedExtension(file);
  const uniqueId = crypto.randomUUID();
  const fullPath = `${pathPrefix}/${type}_${uniqueId}.${ext}`;

  try {
    const { data, error } = await supabase.storage
      .from(TOEIC_MEDIA_BUCKET)
      .upload(fullPath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, path: data.path };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi không xác định khi upload.' };
  }
}

/**
 * Helper to generate a signed URL for a given private path in toeic-media bucket
 */
export async function getToeicMediaSignedUrl(path: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  
  try {
    const { data, error } = await supabase.storage
      .from(TOEIC_MEDIA_BUCKET)
      .createSignedUrl(path, expiresIn);
      
    if (error) {
      console.error('Error generating signed URL:', error.message);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error('Error generating signed URL:', err);
    return null;
  }
}

/**
 * Helper to safely delete an object from toeic-media bucket
 */
export async function deleteToeicMedia(path: string): Promise<boolean> {
  if (!path) return true; // Nothing to delete
  
  try {
    const { error } = await supabase.storage
      .from(TOEIC_MEDIA_BUCKET)
      .remove([path]);
      
    if (error) {
      console.error('Error deleting media:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error deleting media:', err);
    return false;
  }
}
