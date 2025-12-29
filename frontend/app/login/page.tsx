'use client'

/**
 * Login Page
 *
 * Automatically redirects to Keycloak for SSO authentication.
 * Preserves callbackUrl to redirect back to original page after login.
 */

import { useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const { status } = useSession()

  useEffect(() => {
    // If already authenticated, redirect to callback URL
    if (status === 'authenticated') {
      window.location.replace(callbackUrl)
      return
    }

    // If not authenticated and not loading, redirect to Keycloak
    if (status === 'unauthenticated') {
      signIn('keycloak', { callbackUrl })
    }
  }, [status, callbackUrl])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-violet-600 mx-auto"></div>
        <p className="mt-6 text-lg font-medium text-gray-700">SSO 로그인 페이지로 이동 중...</p>
        <p className="mt-2 text-sm text-gray-500">잠시만 기다려주세요</p>
      </div>
    </div>
  )
}
