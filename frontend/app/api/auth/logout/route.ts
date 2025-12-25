/**
 * Custom Logout Endpoint
 *
 * Handles SSO logout by redirecting browser to Keycloak logout URL.
 * This ensures both NextAuth session AND Keycloak browser session are cleared.
 *
 * Flow:
 * 1. Get id_token from session (cookie still alive at this point)
 * 2. Redirect browser to Keycloak logout URL with id_token_hint
 * 3. Keycloak clears its browser session cookies
 * 4. Keycloak redirects to /auth/logout-success
 * 5. logout-success page calls signOut() to clear NextAuth session
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function GET(request: NextRequest) {
  // Calculate baseUrl FIRST (before any async operations)
  // Use NEXTAUTH_URL to avoid 0.0.0.0 issues in Kubernetes
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('x-forwarded-host') || request.headers.get('host')}`

  // Get token while session cookie is still alive
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // Redirect to Keycloak logout if we have id_token
  if (token?.idToken) {
    const keycloakIssuer = process.env.KEYCLOAK_ISSUER
    const logoutUrl = `${keycloakIssuer}/protocol/openid-connect/logout`

    // Redirect to logout-success page (NOT with logout param to avoid loops)
    const redirectUri = `${baseUrl}/auth/logout-success`

    const params = new URLSearchParams({
      id_token_hint: token.idToken as string,
      post_logout_redirect_uri: redirectUri,
    })

    return NextResponse.redirect(`${logoutUrl}?${params.toString()}`)
  }

  // No id_token available - go directly to logout-success
  // This handles edge cases like expired tokens
  return NextResponse.redirect(new URL('/auth/logout-success', baseUrl))
}
