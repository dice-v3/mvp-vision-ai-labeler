/**
 * Type Definitions
 *
 * Backend API와 일치하는 TypeScript 타입 정의
 */

// ============================================================================
// User & Authentication (Keycloak)
// ============================================================================

export interface User {
  id: string;  // Keycloak sub (UUID)
  email: string;
  name?: string;
  full_name?: string;
  roles: string[];
  is_admin: boolean;
}

// ============================================================================
// Dataset
// ============================================================================

export interface Dataset {
  id: string;
  name: string;
  description: string;
  owner_id: string;  // Keycloak user sub (UUID)
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
}

// ============================================================================
// Annotation Project
// ============================================================================

export interface ClassInfo {
  name: string;
  color: string;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  dataset_id: string;
  owner_id: string;  // Keycloak user sub (UUID)
  task_types: string[];
  task_config: Record<string, any>;
  // Phase 2.9: Task-based classes
  task_classes?: Record<string, Record<string, ClassInfo>>;  // {task_type: {class_id: ClassInfo}}
  classes: Record<string, ClassInfo>;  // Legacy field for backward compatibility
  settings: Record<string, any>;
  total_images: number;
  annotated_images: number;
  total_annotations: number;
  status: string;
  created_at: string;
  updated_at: string;
  last_updated_by?: string;  // Keycloak user sub (UUID)
  // Joined fields
  dataset_name?: string;
  dataset_num_items?: number;
  last_updated_by_name?: string;
  last_updated_by_email?: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  dataset_id: string;
  task_types: string[];
  task_config: Record<string, any>;
  classes: Record<string, ClassInfo>;
  settings?: Record<string, any>;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  task_types?: string[];
  task_config?: Record<string, any>;
  classes?: Record<string, ClassInfo>;
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
