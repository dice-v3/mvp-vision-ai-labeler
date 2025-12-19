"use client"

/**
 * NextAuth Session Provider
 *
 * Wraps the application with NextAuth session context
 */

import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"

interface AuthSessionProviderProps {
  children: ReactNode
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  return <SessionProvider>{children}</SessionProvider>
}
