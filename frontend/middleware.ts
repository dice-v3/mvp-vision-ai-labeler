/**
 * NextAuth Middleware
 *
 * Protects routes that require authentication.
 * Redirects unauthenticated users to login page with callbackUrl.
 *
 * Public routes (no auth required):
 * - / (landing page with login button)
 * - /login (login redirect page)
 * - /auth/* (NextAuth routes including logout-success)
 * - /api/auth/* (NextAuth API routes)
 */

import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Public routes - no auth required
  if (pathname === "/") {
    return NextResponse.next()
  }

  // NextAuth API routes - pass through
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next()
  }

  // Auth pages (login, logout-success) - pass through
  if (pathname.startsWith("/login") || pathname.startsWith("/auth/")) {
    return NextResponse.next()
  }

  // Check token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // Authenticated users - allow access
  if (token) {
    return NextResponse.next()
  }

  // Unauthenticated users - redirect to login with callbackUrl
  const loginUrl = new URL("/login", request.url)
  const originalPath = pathname + search
  loginUrl.searchParams.set("callbackUrl", originalPath)

  return NextResponse.redirect(loginUrl)
}

// Protect all routes except public ones
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - / (landing page - shows login button for unauthenticated users)
     * - /login (login redirect page)
     * - /auth/* (NextAuth pages including /auth/logout-success - REQUIRED for SSO logout!)
     * - /api/auth/* (NextAuth API routes)
     * - /_next (Next.js internals)
     * - /favicon.ico, /images, /fonts (static files)
     */
    "/((?!$|login|auth|api/auth|_next|favicon.ico|images|fonts).*)",
  ],
}
