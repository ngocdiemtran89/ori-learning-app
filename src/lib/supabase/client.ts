import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl.trim() === '') {
  console.error('[ORI Supabase Error] VITE_SUPABASE_URL is missing in environment variables.');
  throw new Error('ORI Learning configuration error: VITE_SUPABASE_URL is missing.');
}

if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
  console.error('[ORI Supabase Error] VITE_SUPABASE_ANON_KEY is missing in environment variables.');
  throw new Error('ORI Learning configuration error: VITE_SUPABASE_ANON_KEY is missing.');
}

try {
  const parsed = new URL(supabaseUrl);
  if (!parsed.protocol.startsWith('http')) {
    throw new Error('Invalid protocol');
  }
} catch {
  console.error('[ORI Supabase Error] VITE_SUPABASE_URL format is invalid.');
  throw new Error('ORI Learning configuration error: VITE_SUPABASE_URL is malformed.');
}

/**
 * Single Centralized Supabase Client for ORI Learning
 * Protected by Row Level Security (RLS) on PostgreSQL
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
