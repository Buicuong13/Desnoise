/**
 * Edge middleware — gates routes based on the `denoise_token` cookie.
 *
 *   /dashboard/* and /admin/* require a token → redirect to /login if missing.
 *   /login and /register bounce already-authenticated users to /dashboard.
 *
 * Token validity is NOT verified here (we don't want to decode the JWT at the
 * edge); the client-side `auth-store.hydrate()` calls `/users/me` and clears
 * the cookie if the backend rejects it. This middleware only checks presence.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const TOKEN_COOKIE = 'denoise_token'

const PROTECTED_PREFIXES = ['/dashboard', '/admin']
const AUTH_ROUTES = ['/login', '/register']

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const token = req.cookies.get(TOKEN_COOKIE)?.value
  const isAuthed = Boolean(token)

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
  const isAuthPage = AUTH_ROUTES.includes(pathname)

  if (isProtected && !isAuthed) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    // Preserve where the user was heading so the login page could redirect back.
    url.searchParams.set('next', pathname + search)
    return NextResponse.redirect(url)
  }

  if (isAuthPage && isAuthed) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

// Run on every page route except Next.js internals & static assets.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images|public).*)'],
}
