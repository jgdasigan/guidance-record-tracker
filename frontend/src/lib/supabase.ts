import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const supabaseConfigured = url !== '' && anonKey !== ''

// The anon key is public. Student rows stay closed because the database
// only returns them to a signed-in counselor or administrator.
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url, anonKey)
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase is not configured in this build.')
  }
  return supabase
}
