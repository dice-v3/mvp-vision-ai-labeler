/**
 * NextAuth Middleware
 *
 * Protects routes that require authentication
 * Redirects unauthenticated users to Keycloak login
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
      signIn: "/login",
    },
  }
)

// Protect all routes except public ones
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login (login page for Keycloak theme reference)
     * - /api/auth (NextAuth API routes)
     * - /_next (Next.js internals)
     * - /favicon.ico, /images, /fonts (static files)
     */
    "/((?!login|api/auth|_next|favicon.ico|images|fonts).*)",
  ],
}
