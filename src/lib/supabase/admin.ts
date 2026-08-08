import { supabase } from './client';
import { Profile, AccountStatus } from './types';

/**
 * Fetch all student profiles for admin view under public.is_admin() RLS policy
 */
export async function getAllStudentProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[ORI Admin] Error fetching student profiles:', error.message);
    return [];
  }
  return data as Profile[];
}

/**
 * Update a student's level, status, or access_expires_at date
 */
export async function updateStudentProfile(
  userId: string,
  updates: {
    level?: string;
    status?: AccountStatus;
    access_expires_at?: string | null;
  }
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[ORI Admin] Error updating student profile:', error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}
