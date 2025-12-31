"use client"

/**
 * Authentication Context (Keycloak via NextAuth)
 *
 * React hooks for managing authentication state with NextAuth/Keycloak
 * 보안: HttpOnly Cookie 기반 세션 사용 (localStorage 미사용)
 */

import { useSession, signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useEffect } from "react"
import { APIClient } from "../api/client"

export interface KeycloakUser {
  id: string
  email: string | null
  name: string | null
  roles: string[]
  isAdmin: boolean
}

export interface AuthState {
  user: KeycloakUser | null
  accessToken: string | null
  loading: boolean
  isAuthenticated: boolean
  error: string | null
  login: () => void
  logout: () => Promise<void>
}

/**
 * Hook to access authentication state and methods
 */
export function useAuth(): AuthState {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Sync token cache with session changes
  useEffect(() => {
    if (session?.accessToken) {
      APIClient.updateToken(session.accessToken)
    } else if (status === "unauthenticated") {
      APIClient.clearTokenCache()
    }
  }, [session?.accessToken, status])

  const user: KeycloakUser | null = useMemo(() => {
    if (!session?.user) return null
    return {
      id: session.user.id,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
      roles: session.roles ?? [],
      isAdmin: session.roles?.includes("admin") ?? false,
    }
  }, [session?.user?.id, session?.user?.email, session?.user?.name, session?.roles])

  const login = useCallback(() => {
    signIn("keycloak", { callbackUrl: "/" })
  }, [])

  const logout = useCallback(async () => {
    // Clear API client token cache
    APIClient.clearTokenCache()
    
    // Redirect to custom logout endpoint for proper SSO logout
    // This ensures both NextAuth and Keycloak sessions are cleared
    // DO NOT call signOut() here - it deletes session cookie before we can get id_token
    window.location.href = '/api/auth/logout'
  }, [])

  return {
    user,
    accessToken: session?.accessToken ?? null,
    loading: status === "loading",
    isAuthenticated: status === "authenticated",
    error: session?.error ?? null,
    login,
    logout,
  }
}

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth() {
  const { isAuthenticated, loading, login } = useAuth()
  const router = useRouter()

  if (!loading && !isAuthenticated) {
    login()
  }

  return { isAuthenticated, loading }
}

// Re-export for backward compatibility
export { useSession, signIn, signOut } from "next-auth/react"
