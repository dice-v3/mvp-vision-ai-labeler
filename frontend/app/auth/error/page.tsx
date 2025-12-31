'use client'

/**
 * NextAuth Error Page
 *
 * Handles authentication errors from Keycloak.
 * For silent SSO check failures (login_required), redirects to main page
 * with sso_checked flag to show login button instead of retry.
 */

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  useEffect(() => {
    // For silent SSO check failures, set flag and redirect to main
    // This allows the main page to show login button instead of retrying SSO check
    if (error === 'OAuthCallback' || error === 'AccessDenied') {
      // Mark SSO check as done (failed) - prevents infinite redirect loop
      sessionStorage.setItem('sso_check_done', 'true')
      // Redirect to main page
      window.location.replace('/')
      return
    }
  }, [error])

  // For other errors, show error message
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="mb-6">
          <svg
            className="w-16 h-16 mx-auto text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          로그인 오류
        </h1>
        <p className="text-gray-600 mb-6">
          {error === 'Configuration' && '서버 설정 오류가 발생했습니다.'}
          {error === 'AccessDenied' && '접근이 거부되었습니다.'}
          {error === 'Verification' && '인증 검증에 실패했습니다.'}
          {!error && '알 수 없는 오류가 발생했습니다.'}
          {error && !['Configuration', 'AccessDenied', 'Verification', 'OAuthCallback'].includes(error) && 
            `오류: ${error}`}
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors"
        >
          홈으로 돌아가기
        </a>
      </div>
    </div>
  )
}
