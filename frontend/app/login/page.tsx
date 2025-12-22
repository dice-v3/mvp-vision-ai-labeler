'use client';

/**
 * Login Page
 *
 * Automatically redirects to Keycloak for SSO authentication.
 * This page ensures a smooth transition from main URL -> signin page -> Keycloak.
 */

import { useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (status === 'authenticated') {
      router.push('/');
      return;
    }

    // If not authenticated and not loading, redirect to Keycloak
    if (status === 'unauthenticated') {
      // Automatically trigger Keycloak signin
      signIn('keycloak', { callbackUrl: '/' });
    }
  }, [status, router]);

  // Show loading state while redirecting
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

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Vision AI Labeler
        </h1>

        <p className="text-gray-600 mb-8">
          {status === 'loading' && 'Loading...'}
          {status === 'unauthenticated' && 'Redirecting to login...'}
          {status === 'authenticated' && 'Redirecting to dashboard...'}
        </p>

        <div className="flex items-center justify-center space-x-2">
          <svg
            className="animate-spin h-6 w-6 text-violet-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
