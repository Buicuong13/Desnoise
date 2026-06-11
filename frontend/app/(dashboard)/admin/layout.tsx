'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/lib/auth-store'

/**
 * Role guard for /admin/*. The parent (dashboard) layout already hydrates the
 * session and bounces unauthenticated users to /login; here we additionally
 * require `role === 'admin'` and send everyone else back to their dashboard.
 *
 * This is defence-in-depth only — every admin API route is independently gated
 * server-side (the `AdminUser` dependency), so a non-admin who slips past this
 * client check still gets 403 from the backend.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isHydrating, isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isHydrating && isAuthenticated && user?.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [isHydrating, isAuthenticated, user?.role, router])

  if (isHydrating || user?.role !== 'admin') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Checking permissions…</div>
      </div>
    )
  }

  return <>{children}</>
}
