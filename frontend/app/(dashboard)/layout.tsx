'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { DashboardLayout } from '@/components/dashboard/layout'
import { useAuth } from '@/lib/auth-store'

/**
 * Middleware (see `middleware.ts`) handles the "no cookie → /login" redirect
 * at the edge, so by the time this client component renders we already have
 * a token cookie. We still need to hydrate the Zustand store from
 * `/users/me` so the UI has user info (role, quota, name, ...).
 *
 * Edge case: cookie is present but the JWT is invalid/expired. Middleware
 * lets the request through (it doesn't verify); hydrate() then fails and
 * clears the cookie. The effect below catches that and bounces to /login.
 */
export default function DashboardLayoutPage({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated, isHydrating, hydrate } = useAuth()

  useEffect(() => {
    if (isHydrating) hydrate()
  }, [isHydrating, hydrate])

  useEffect(() => {
    if (!isHydrating && !isAuthenticated) router.replace('/login')
  }, [isHydrating, isAuthenticated, router])

  if (isHydrating || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return <DashboardLayout>{children}</DashboardLayout>
}
