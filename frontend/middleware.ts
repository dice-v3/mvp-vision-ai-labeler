/**
 * NextAuth Middleware
 *
 * Protects routes that require authentication
 * Redirects unauthenticated users directly to Keycloak
 */

import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    // Token is valid, allow access
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      // 바로 Keycloak으로 리다이렉트
      signIn: "/api/auth/signin/keycloak",
    },
  }
)

// Protect all routes except public ones
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /api/auth (NextAuth API routes)
     * - /_next (Next.js internals)
     * - /favicon.ico, /images, /fonts (static files)
     */
    "/((?!api/auth|_next|favicon.ico|images|fonts).*)",
  ],
}
