'use client'

/**
 * Zustand auth store backed by the FastAPI backend.
 *
 * State shape:
 *   - `user`: the current `ApiUser` (or `null` when signed out / not loaded yet).
 *   - `isAuthenticated`: derived from `user !== null`.
 *   - `isLoading`: only true while an auth action is in-flight (login/register
 *      submit). Page-level "are we hydrated yet" lives in `isHydrating`.
 *   - `isHydrating`: true on first load until we have either restored the
 *      session from `localStorage` or confirmed there is none. Use this in
 *      protected layouts to avoid a flash-of-unauthenticated content.
 *
 * Token persistence is centralised in `lib/api/client.ts` (`setStoredToken`).
 */
import { create } from 'zustand'

import {
  ApiError,
  api,
  getStoredToken,
  setStoredToken,
  setStoredRefreshToken,
} from './api'
import type { ApiUser, AuthSession, UserRole } from './api/types'

interface AuthState {
  user: ApiUser | null
  isAuthenticated: boolean
  isLoading: boolean
  isHydrating: boolean
  error: string | null
}

interface AuthActions {
  hydrate: () => Promise<void>
  /** Re-fetch the current user (e.g. after an upload changes `images_used`). */
  refreshUser: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName?: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

type AuthStore = AuthState & AuthActions

function applySession(set: (partial: Partial<AuthState>) => void, session: AuthSession) {
  setStoredToken(session.access_token)
  setStoredRefreshToken(session.refresh_token)
  set({
    user: session.user,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  })
}

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isHydrating: true,
  error: null,

  hydrate: async () => {
    const token = getStoredToken()
    if (!token) {
      set({ isHydrating: false })
      return
    }
    try {
      const user = await api.auth.me()
      set({ user, isAuthenticated: true, isHydrating: false })
    } catch {
      // Token is stale / invalid and refresh (handled in the API client) also
      // failed — clear both tokens and let the edge middleware bounce the next
      // request to /login. Full reload ensures the cookie change is observed by
      // middleware on the very next hop.
      setStoredToken(null)
      setStoredRefreshToken(null)
      set({ user: null, isAuthenticated: false, isHydrating: false })
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.replace('/login')
      }
    }
  },

  refreshUser: async () => {
    if (!getStoredToken()) return
    try {
      const user = await api.auth.me()
      set({ user, isAuthenticated: true })
    } catch {
      // Best-effort — keep the current user on a transient failure.
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const session = await api.auth.login({ email, password })
      applySession(set, session)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed'
      set({ isLoading: false, error: message })
      throw err
    }
  },

  register: async (email, password, fullName) => {
    set({ isLoading: true, error: null })
    try {
      const session = await api.auth.register({
        email,
        password,
        full_name: fullName,
      })
      applySession(set, session)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Register failed'
      set({ isLoading: false, error: message })
      throw err
    }
  },

  logout: async () => {
    try {
      await api.auth.logout()
    } catch {
      // Server may be unreachable; clear local state anyway.
    }
    setStoredToken(null)
    setStoredRefreshToken(null)
    set({ user: null, isAuthenticated: false, error: null })
  },

  clearError: () => set({ error: null }),
}))

export function hasRole(user: ApiUser | null, ...roles: UserRole[]): boolean {
  return !!user && roles.includes(user.role)
}
