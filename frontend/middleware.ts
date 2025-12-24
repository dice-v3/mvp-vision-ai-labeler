/**
 * NextAuth Middleware
 *
 * Protects routes that require authentication
 * Redirects unauthenticated users to login page
 *
 * Public routes (no auth required):
 * - / (landing page with login button)
 * - /login (login redirect page)
 * - /auth/* (NextAuth routes including logout-success)
 * - /api/auth/* (NextAuth API routes)
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
      // Redirect to Keycloak login
      signIn: "/login",
    },
  }
)

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
