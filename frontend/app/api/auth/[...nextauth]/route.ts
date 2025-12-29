/**
 * NextAuth.js API Route
 *
 * Handles Keycloak OIDC authentication
 */

import NextAuth, { NextAuthOptions } from "next-auth"
import KeycloakProvider from "next-auth/providers/keycloak"

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60, // 1 hour
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Initial sign in - save tokens
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
        token.idToken = account.id_token

        // Extract roles from Keycloak token
        if (profile) {
          const keycloakProfile = profile as any
          token.roles = keycloakProfile.realm_access?.roles || []
        }
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.expiresAt as number) * 1000) {
        return token
      }

      // Access token has expired, try to refresh it
      return refreshAccessToken(token)
    },

    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string
      session.error = token.error as string | undefined
      session.roles = token.roles as string[] || []

      if (session.user) {
        session.user.id = token.sub as string
      }

      return session
    },
  },
  // Note: Keycloak logout is handled by /api/auth/logout endpoint
  // which redirects browser to Keycloak (clearing SSO cookies)
  // Server-side fetch here would NOT clear browser cookies!
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(token: any) {
  try {
    // 개발 환경에서 self-signed certificate 허용
    if (process.env.NODE_ENV === "development" && typeof process !== "undefined") {
      // @ts-ignore - Node.js only
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
    }

    const issuer = process.env.KEYCLOAK_ISSUER
    const tokenEndpoint = `${issuer}/protocol/openid-connect/token`

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.KEYCLOAK_CLIENT_ID!,
        client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw refreshedTokens
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + refreshedTokens.expires_in,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    }
  } catch (error) {
    console.error("Error refreshing access token:", error)

    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
