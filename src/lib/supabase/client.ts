import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(rawUrl && rawUrl.trim() !== '' && rawKey && rawKey.trim() !== '');

export const supabaseConfigError = !rawUrl || rawUrl.trim() === ''
  ? 'Thiếu biến môi trường VITE_SUPABASE_URL trên Vercel.'
  : !rawKey || rawKey.trim() === ''
  ? 'Thiếu biến môi trường VITE_SUPABASE_ANON_KEY trên Vercel.'
  : null;

const validUrl = isSupabaseConfigured ? rawUrl : 'https://gkrlcmucebityfeslyhw.supabase.co';
const validKey = isSupabaseConfigured ? rawKey : 'placeholder-key';

if (!isSupabaseConfigured) {
  console.error('[ORI Supabase Configuration Error]', supabaseConfigError);
}

/**
 * Single Centralized Supabase Client for ORI Learning
 * Protected by Row Level Security (RLS) on PostgreSQL
 */
export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
