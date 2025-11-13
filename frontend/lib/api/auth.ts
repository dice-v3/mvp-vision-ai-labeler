/**
 * Authentication API
 *
 * 로그인, 사용자 정보 조회 등 인증 관련 API
 */

import { apiClient } from './client';
import type { LoginRequest, TokenResponse, User } from '../types';

/**
 * Login with email and password
 */
export async function login(credentials: LoginRequest): Promise<TokenResponse> {
  const response = await apiClient.post<TokenResponse>('/api/v1/auth/login', credentials);

  // Save token to client
  apiClient.setToken(response.access_token);

  return response;
}

/**
 * Logout (clear token)
 */
export function logout(): void {
  apiClient.setToken(null);
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<User> {
  return apiClient.get<User>('/api/v1/auth/me');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return apiClient.getToken() !== null;
}
