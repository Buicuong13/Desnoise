/**
 * Thin typed wrapper around `fetch` for the FastAPI backend.
 *
 * Responsibilities:
 *   - Read base URL from `NEXT_PUBLIC_API_URL` (defaults to localhost:8000).
 *   - Pull the bearer token from `localStorage` and attach it to every request.
 *   - Normalize backend errors into `ApiError` instances.
 *   - Provide helpers for JSON requests and `multipart/form-data` uploads.
 *
 * UI code should NOT call `fetch` directly — go through this client (or one
 * of the domain modules in `lib/api/*`) so auth and errors stay consistent.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:8000'

/**
 * Token is persisted as a cookie (not localStorage) so the Next.js middleware
 * can read it on the edge and gate routes server-side. The cookie is NOT
 * httpOnly because the client also needs to read it to attach the `Authorization`
 * header to API calls — for production switch to a backend session cookie or
 * httpOnly + same-origin proxy.
 */
export const TOKEN_COOKIE = 'denoise_token'
export const REFRESH_COOKIE = 'denoise_refresh'

// The access JWT itself still expires server-side (default 30 min); the cookie
// only needs to outlive that so the edge middleware keeps gating the user in
// while the client silently refreshes. Align it with the refresh-token window
// so an active user is never bounced before their refresh token expires.
const TOKEN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14 // 14 days
const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14 // 14 days

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${encodeURIComponent(name)}=`
  for (const part of document.cookie.split(';')) {
    const c = part.trim()
    if (c.startsWith(prefix)) return decodeURIComponent(c.slice(prefix.length))
  }
  return null
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:'
  document.cookie =
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax` +
    (secure ? '; Secure' : '')
}

function clearCookie(name: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; SameSite=Lax`
}

export function getStoredToken(): string | null {
  return readCookie(TOKEN_COOKIE)
}

export function setStoredToken(token: string | null): void {
  if (token) writeCookie(TOKEN_COOKIE, token, TOKEN_COOKIE_MAX_AGE_SECONDS)
  else clearCookie(TOKEN_COOKIE)
}

export function getStoredRefreshToken(): string | null {
  return readCookie(REFRESH_COOKIE)
}

export function setStoredRefreshToken(token: string | null): void {
  if (token) writeCookie(REFRESH_COOKIE, token, REFRESH_COOKIE_MAX_AGE_SECONDS)
  else clearCookie(REFRESH_COOKIE)
}

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Send as multipart/form-data instead of JSON. */
  form?: FormData
  /** Override / disable the auth header. */
  auth?: boolean
  /** Extra headers. */
  headers?: Record<string, string>
  /** Don't parse a JSON body; return raw Response (e.g. for downloads). */
  raw?: boolean
  /** AbortSignal for cancelation. */
  signal?: AbortSignal
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data?.detail === 'string') return data.detail
    if (Array.isArray(data?.detail)) {
      // FastAPI 422 validation errors
      return data.detail
        .map((e: { loc?: string[]; msg?: string }) => `${e.loc?.join('.') ?? ''}: ${e.msg ?? ''}`)
        .join('; ')
    }
    return JSON.stringify(data)
  } catch {
    return res.statusText || `HTTP ${res.status}`
  }
}

/**
 * Silent token refresh. A 401 on any authed request triggers a single shared
 * call to /auth/refresh (single-flight, so a burst of 401s only refreshes once);
 * on success the original request is retried transparently. When the refresh
 * token is missing/expired, the session is cleared and the user is sent to
 * /login?expired=1 — never left stuck on a page with a dead token.
 */
const AUTH_PATH_PREFIX = '/api/v1/auth/'
let refreshInFlight: Promise<boolean> | null = null
let redirectingToLogin = false

async function doRefresh(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken()
  if (!refreshToken) return false
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { access_token?: string; refresh_token?: string }
    if (!data.access_token) return false
    setStoredToken(data.access_token)
    if (data.refresh_token) setStoredRefreshToken(data.refresh_token)
    return true
  } catch {
    return false
  }
}

function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

function handleSessionExpired(): void {
  setStoredToken(null)
  setStoredRefreshToken(null)
  if (
    typeof window !== 'undefined' &&
    !redirectingToLogin &&
    !window.location.pathname.startsWith('/login')
  ) {
    redirectingToLogin = true
    window.location.replace('/login?expired=1')
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  opts: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const { method = 'GET', body, form, auth = true, headers = {}, raw = false, signal } = opts

  const finalHeaders: Record<string, string> = { ...headers }

  if (auth) {
    const token = getStoredToken()
    if (token) finalHeaders.Authorization = `Bearer ${token}`
  }

  let payload: BodyInit | undefined
  if (form) {
    payload = form
    // Let the browser set the multipart boundary automatically.
  } else if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`
  const res = await fetch(url, { method, headers: finalHeaders, body: payload, signal })

  if (!res.ok) {
    // Access token expired mid-session: refresh once and retry transparently.
    if (res.status === 401 && auth && !isRetry && !path.startsWith(AUTH_PATH_PREFIX)) {
      const refreshed = await tryRefresh()
      if (refreshed) return apiRequest<T>(path, opts, true)
      handleSessionExpired()
    }
    const detail = await parseErrorDetail(res)
    throw new ApiError(res.status, detail)
  }

  if (raw) return res as unknown as T
  if (res.status === 204) return undefined as T

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return (await res.json()) as T
  }
  return (await res.text()) as unknown as T
}
