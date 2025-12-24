'use client'

/**
 * Logout Success Page
 *
 * Intermediate page after Keycloak logout.
 * This page:
 * 1. Shows "로그아웃 중입니다..." message
 * 2. Calls signOut() to clear NextAuth client session
 * 3. Redirects to main page using window.location.replace (no history)
 *
 * IMPORTANT:
 * - callbackUrl: '/' is REQUIRED to prevent redirect loop on re-login
 * - window.location.replace prevents back button returning here
 */

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'

export default function LogoutSuccessPage() {
  useEffect(() => {
    // Clear NextAuth client session
    // callbackUrl: '/' is CRITICAL - without it, re-login redirects back here!
    signOut({ redirect: false, callbackUrl: '/' })
      .then(() => {
        // Use replace to prevent this page from staying in browser history
        window.location.replace('/')
      })
      .catch((error) => {
        console.error('signOut failed:', error)
        // Even on error, redirect to home
        window.location.replace('/')
      })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50">
      <div className="text-center">
        <div className="mb-8">
          <svg
            className="w-20 h-20 mx-auto text-violet-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
        </div>

        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-violet-600 mx-auto mb-6"></div>

        <p className="text-lg text-gray-700">로그아웃 중입니다...</p>
      </div>
    </div>
  )
}
