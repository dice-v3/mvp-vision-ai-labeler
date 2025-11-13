/**
 * Type Definitions
 *
 * Backend API와 일치하는 TypeScript 타입 정의
 */

// ============================================================================
// User & Authentication
// ============================================================================

export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
  badge_color: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// ============================================================================
// Dataset
// ============================================================================

export interface Dataset {
  id: string;
  name: string;
  description: string;
  owner_id: number;
  format: string;
  source: string;
  visibility: string;
  labeled: boolean;
  num_items: number;
  size_mb: string;
  storage_path: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  // Joined fields
  owner_name?: string;
  owner_email?: string;
  owner_badge_color?: string;
}

// ============================================================================
// Annotation Project
// ============================================================================

export interface Project {
  id: string;
  name: string;
  description: string;
  dataset_id: string;
  owner_id: number;
  task_types: string[];
  task_config: Record<string, any>;
  classes: Record<string, number>;
  settings: Record<string, any>;
  total_images: number;
  annotated_images: number;
  total_annotations: number;
  status: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  dataset_name?: string;
  dataset_num_items?: number;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  dataset_id: string;
  task_types: string[];
  task_config: Record<string, any>;
  classes: Record<string, number>;
  settings?: Record<string, any>;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  task_types?: string[];
  task_config?: Record<string, any>;
  classes?: Record<string, number>;
  settings?: Record<string, any>;
  status?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface APIError {
  detail: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}
