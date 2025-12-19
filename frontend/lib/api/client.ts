/**
 * API Client (Keycloak/NextAuth Integration)
 *
 * Backend API와 통신하기 위한 클라이언트
 * NextAuth 세션에서 access token을 가져와서 사용
 */

import { getSession } from "next-auth/react"
import type { APIError } from "../types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001"

export class APIClient {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  /**
   * Get access token from NextAuth session
   */
  private async getAccessToken(): Promise<string | null> {
    if (typeof window === "undefined") {
      // Server-side: cannot get session
      return null
    }

    const session = await getSession()
    return session?.accessToken ?? null
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
