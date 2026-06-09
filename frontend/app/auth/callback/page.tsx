'use client'

/**
 * OAuth landing page. Supabase redirects here after Google sign-in with the
 * session in the URL hash. We read that session, exchange it for a native
 * backend session via the auth store, then forward to the dashboard (or the
 * `next` target the user was originally heading to).
 */
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { useAuth } from '@/lib/auth-store'
import { getSupabase } from '@/lib/supabase'

function Callback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const loginWithGoogle = useAuth((s) => s.loginWithGoogle)
  const [error, setError] = useState('')
  // React Strict Mode mounts effects twice in dev; guard so we bridge once.
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const next = searchParams.get('next') || '/dashboard'

    const run = async () => {
      const supabase = getSupabase()
      if (!supabase) {
        setError('Google sign-in is not configured.')
        return
      }
      try {
        const { data, error: sessErr } = await supabase.auth.getSession()
        if (sessErr || !data.session?.access_token) {
          throw new Error(sessErr?.message || 'No Google session returned')
        }
        await loginWithGoogle(data.session.access_token)
        // The backend now owns our session; drop the Supabase one to avoid two
        // competing token stores in the browser.
        await supabase.auth.signOut()
        router.replace(next)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Google sign-in failed')
      }
    }

    void run()
  }, [router, searchParams, loginWithGoogle])

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-destructive text-sm">{error}</p>
        <button
          onClick={() => router.replace('/login')}
          className="text-primary text-sm font-medium hover:underline"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">Signing you in…</p>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={null}>
      <Callback />
    </Suspense>
  )
}
