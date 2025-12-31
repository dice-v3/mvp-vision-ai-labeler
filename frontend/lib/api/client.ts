/**
 * API Client (Keycloak/NextAuth Integration)
 *
 * Backend API와 통신하기 위한 클라이언트
 * NextAuth 세션에서 access token을 가져와서 사용
 * 
 * 보안: localStorage 대신 NextAuth 세션(HttpOnly Cookie) 사용
 */

import { getSession } from "next-auth/react"
import type { APIError } from "../types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001"

// Token cache with expiry
let cachedToken: string | null = null
let tokenExpiry: number = 0
let tokenFetchPromise: Promise<string | null> | null = null

export class APIClient {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  /**
   * Get access token from NextAuth session with caching
   * - Caches token for 5 minutes to prevent excessive getSession() calls
   * - Shares single fetch promise to prevent parallel requests
   */
  private async getAccessToken(): Promise<string | null> {
    if (typeof window === "undefined") {
      return null
    }

    // Return cached token if still valid (5 min cache)
    const now = Date.now()
    if (cachedToken && tokenExpiry > now) {
      return cachedToken
    }

    // If already fetching, wait for that promise
    if (tokenFetchPromise) {
      return tokenFetchPromise
    }

    // Fetch from NextAuth session
    tokenFetchPromise = getSession()
      .then(session => {
        cachedToken = session?.accessToken ?? null
        // Cache for 5 minutes (or until page refresh)
        tokenExpiry = Date.now() + 5 * 60 * 1000
        tokenFetchPromise = null
        return cachedToken
      })
      .catch(() => {
        tokenFetchPromise = null
        return null
      })

    return tokenFetchPromise
  }

  /**
   * Update cached token (call when session is refreshed)
   */
  static updateToken(token: string | null) {
    cachedToken = token
    tokenExpiry = token ? Date.now() + 5 * 60 * 1000 : 0
  }

  /**
   * Clear cached token (call on logout)
   */
  static clearTokenCache() {
    cachedToken = null
    tokenExpiry = 0
    tokenFetchPromise = null
  }

  /**
   * Generic request method
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    }

    // Add authorization header if token exists
    const token = await this.getAccessToken()
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      // Handle non-2xx responses
      if (!response.ok) {
        const error: APIError = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
        }))
        throw new Error(error.detail)
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null as T
      }

      return await response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error("Network error occurred")
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" })
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      body: data ? JSON.stringify(data) : undefined,
    })
  }
}

// Export singleton instance
export const apiClient = new APIClient()
