/**
 * Auth endpoints: register, login, current user, logout.
 *
 * The session-returning endpoints (`register`, `login`) yield an `access_token`
 * + the user record in one round-trip. Callers should persist the token via
 * `setStoredToken()` so subsequent requests include it automatically.
 */
import { apiRequest, getStoredRefreshToken } from './client'
import type { ApiUser, AuthSession } from './types'

export interface RegisterPayload {
  email: string
  password: string
  full_name?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export function register(payload: RegisterPayload): Promise<AuthSession> {
  return apiRequest<AuthSession>('/api/v1/auth/register', {
    method: 'POST',
    body: payload,
    auth: false,
  })
}

export function login(payload: LoginPayload): Promise<AuthSession> {
  return apiRequest<AuthSession>('/api/v1/auth/login', {
    method: 'POST',
    body: payload,
    auth: false,
  })
}

export function logout(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>('/api/v1/auth/logout', {
    method: 'POST',
    body: { refresh_token: getStoredRefreshToken() },
  })
}

export function me(): Promise<ApiUser> {
  return apiRequest<ApiUser>('/api/v1/users/me')
}
