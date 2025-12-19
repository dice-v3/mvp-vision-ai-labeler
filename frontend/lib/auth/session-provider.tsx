"use client"

/**
 * NextAuth Session Provider
 *
 * Wraps the application with NextAuth session context
 * Uses /auth basePath instead of default /api/auth to avoid Istio routing conflicts
 */

import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"

interface AuthSessionProviderProps {
  children: ReactNode
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  return (
    <SessionProvider basePath="/auth">
      {children}
    </SessionProvider>
  )
}
