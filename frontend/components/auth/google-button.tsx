'use client'

/**
 * "Continue with Google" button. Kicks off the Supabase OAuth redirect; the
 * bridge to a backend session happens on /auth/callback once Google returns.
 *
 * Renders nothing when Supabase env vars are absent, so a misconfigured deploy
 * simply falls back to email/password instead of showing a broken button.
 */
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

export function GoogleButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isSupabaseConfigured) return null

  const handleClick = async () => {
    setError('')
    setLoading(true)
    const supabase = getSupabase()
    if (!supabase) {
      setError('Google sign-in is not configured')
      setLoading(false)
      return
    }
    const callback = new URL('/auth/callback', window.location.origin)
    if (next) callback.searchParams.set('next', next)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback.toString() },
    })
    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
    // On success the browser is redirected to Google, so no cleanup needed.
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="mr-2 h-4 w-4" />
        )}
        Continue with Google
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}
