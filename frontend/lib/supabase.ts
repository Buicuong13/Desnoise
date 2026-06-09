'use client'

/**
 * Browser-only Supabase client, used ONLY for the Google OAuth handshake.
 *
 * The app's real auth lives in the FastAPI backend (see `lib/auth-store.ts`):
 * after Supabase completes the Google redirect we take the resulting Supabase
 * access token and exchange it for a native backend session via
 * `api.auth.oauthGoogle()`. Supabase is never the source of truth for authz.
 *
 * Returns `null` when the env vars are absent so the UI can hide the Google
 * button instead of crashing.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null
  if (_client) return _client
  _client = createClient(url, anonKey, {
    auth: {
      // Implicit flow: tokens come back in the URL hash on the callback page,
      // and supabase-js picks them up automatically (detectSessionInUrl).
      persistSession: true,
      detectSessionInUrl: true,
    },
  })
  return _client
}

export const isSupabaseConfigured = Boolean(url && anonKey)
