/**
 * NextAuth.js API Route
 *
 * Handles Keycloak OIDC authentication
 */

import NextAuth, { NextAuthOptions } from "next-auth"
import KeycloakProvider from "next-auth/providers/keycloak"

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],
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
  events: {
    async signOut({ token }) {
      // Keycloak logout - end session on Keycloak server
      if (token.idToken) {
        const issuer = process.env.KEYCLOAK_ISSUER
        const logoutUrl = `${issuer}/protocol/openid-connect/logout?id_token_hint=${token.idToken}`

        try {
          await fetch(logoutUrl)
        } catch (error) {
          console.error("Keycloak logout error:", error)
        }
      }
    },
  },
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(token: any) {
  try {
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
