import { createClient } from '@supabase/supabase-js';

// Fallback values are provided to ensure the app works during development
// The user can override these by setting VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in their environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zisijswmqoxtfxlgjwgr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6KFWYlCjjniOKdAhfJDMJA_eJT88ZFE';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase URL or Anon Key is missing in environment variables. Using fallback credentials.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
