"use client"

/**
 * Authentication Context (Keycloak via NextAuth)
 *
 * React hooks for managing authentication state with NextAuth/Keycloak
 */

import { useSession, signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useCallback } from "react"

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

  const user: KeycloakUser | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
        roles: session.roles ?? [],
        isAdmin: session.roles?.includes("admin") ?? false,
      }
    : null

  const login = useCallback(() => {
    signIn("keycloak", { callbackUrl: "/dashboard" })
  }, [])

  const logout = useCallback(async () => {
    await signOut({ callbackUrl: "/" })
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
