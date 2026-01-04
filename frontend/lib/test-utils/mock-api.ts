/**
 * Mock API Responses
 *
 * Provides mock implementations for API calls used in Canvas,
 * ImageList, and RightPanel components.
 */

import { vi } from 'vitest';
import type { Annotation, ImageData, Project } from '@/lib/stores/annotationStore';

// ============================================================================
// Mock Annotations API
// ============================================================================

export const mockAnnotationsAPI = {
  createAnnotation: vi.fn().mockResolvedValue({
    id: 'new-annotation-1',
    projectId: 'test-project-1',
    imageId: 'test-image-1',
    annotationType: 'bbox',
    geometry: {
      type: 'bbox',
      bbox: [100, 100, 200, 150],
    },
    classId: 'class-1',
    className: 'Person',
    attributes: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),

  updateAnnotation: vi.fn().mockResolvedValue({
    id: 'annotation-1',
    projectId: 'test-project-1',
    imageId: 'test-image-1',
    annotationType: 'bbox',
    geometry: {
      type: 'bbox',
      bbox: [150, 150, 200, 150],
    },
    classId: 'class-1',
    className: 'Person',
    attributes: {},
    updatedAt: new Date().toISOString(),
  }),

  deleteAnnotation: vi.fn().mockResolvedValue({ success: true }),

  getProjectAnnotations: vi.fn().mockResolvedValue({
    annotations: [],
    total: 0,
  }),

  confirmAnnotation: vi.fn().mockResolvedValue({
    id: 'annotation-1',
    annotation_state: 'confirmed',
    confirmed_at: new Date().toISOString(),
    confirmed_by: 1,
  }),

  unconfirmAnnotation: vi.fn().mockResolvedValue({
    id: 'annotation-1',
    annotation_state: 'draft',
    confirmed_at: null,
    confirmed_by: null,
  }),
};

/**
 * Mocks the annotations API module
 */
export function mockAnnotationsAPIModule() {
  vi.mock('@/lib/api/annotations', () => mockAnnotationsAPI);
  return mockAnnotationsAPI;
}

// ============================================================================
// Mock Projects API
// ============================================================================

export const mockProjectsAPI = {
  getProjectById: vi.fn().mockResolvedValue({
    id: 'test-project-1',
    name: 'Test Project',
    datasetId: 'test-dataset-1',
    taskTypes: ['detection'],
    taskClasses: {
      detection: {
        'class-1': { name: 'Person', color: '#ff0000', order: 0 },
        'class-2': { name: 'Car', color: '#00ff00', order: 1 },
      },
    },
    taskConfig: {},
  }),

  getProjectImages: vi.fn().mockResolvedValue({
    images: [
      {
        id: 'image-1',
        file_name: 'image-1.jpg',
        url: 'http://example.com/image-1.jpg',
        thumbnail_url: 'http://example.com/image-1-thumb.jpg',
        width: 800,
        height: 600,
      },
    ],
    total: 1,
  }),

  getProjectImageStatuses: vi.fn().mockResolvedValue({
    statuses: [
      {
        image_id: 'image-1',
        total_annotations: 0,
        is_image_confirmed: false,
        status: 'not-started',
        has_no_object: false,
      },
    ],
  }),

  confirmImage: vi.fn().mockResolvedValue({
    success: true,
    image_id: 'image-1',
    confirmed_at: new Date().toISOString(),
  }),
};

/**
 * Mocks the projects API module
 */
export function mockProjectsAPIModule() {
  vi.mock('@/lib/api/projects', () => mockProjectsAPI);
  return mockProjectsAPI;
}

// ============================================================================
// Mock Classes API
// ============================================================================

export const mockClassesAPI = {
  reorderClasses: vi.fn().mockResolvedValue({ success: true }),

  createClass: vi.fn().mockResolvedValue({
    id: 'new-class-1',
    name: 'New Class',
    color: '#0000ff',
    order: 2,
  }),

  updateClass: vi.fn().mockResolvedValue({
    id: 'class-1',
    name: 'Updated Class',
    color: '#ff00ff',
    order: 0,
  }),

  deleteClass: vi.fn().mockResolvedValue({ success: true }),
};

/**
 * Mocks the classes API module
 */
export function mockClassesAPIModule() {
  vi.mock('@/lib/api/classes', () => mockClassesAPI);
  return mockClassesAPI;
}

// ============================================================================
// Mock Image Locks API
// ============================================================================

export const mockImageLocksAPI = {
  imageLockAPI: {
    acquireLock: vi.fn().mockResolvedValue({
      success: true,
      lock: {
        image_id: 'image-1',
        user_id: 1,
        user_name: 'Test User',
        acquired_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      },
    }),

    releaseLock: vi.fn().mockResolvedValue({ success: true }),

    renewLock: vi.fn().mockResolvedValue({
      success: true,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }),

    getProjectLocks: vi.fn().mockResolvedValue({
      locks: [],
    }),

    checkLock: vi.fn().mockResolvedValue({
      is_locked: false,
      lock: null,
    }),
  },
};

/**
 * Mocks the image locks API module
 */
export function mockImageLocksAPIModule() {
  vi.mock('@/lib/api/image-locks', () => mockImageLocksAPI);
  return mockImageLocksAPI;
}

// ============================================================================
// Mock Export API
// ============================================================================

export const mockExportAPI = {
  exportAnnotations: vi.fn().mockResolvedValue({
    download_url: 'http://example.com/export.zip',
    format: 'coco',
    file_size: 1024,
  }),
};

/**
 * Mocks the export API module
 */
export function mockExportAPIModule() {
  vi.mock('@/lib/api/export', () => mockExportAPI);
  return mockExportAPI;
}

// ============================================================================
// Mock Version Diff API
// ============================================================================

export const mockVersionDiffAPI = {
  getVersionDiff: vi.fn().mockResolvedValue({
    version_a: {
      id: 1,
      version_number: '1.0',
      version_type: 'manual',
    },
    version_b: {
      id: 2,
      version_number: '2.0',
      version_type: 'manual',
    },
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
  }),

  getAnnotationVersions: vi.fn().mockResolvedValue({
    versions: [
      {
        id: 1,
        version_number: '1.0',
        version_type: 'manual',
        created_at: new Date().toISOString(),
        created_by: 1,
        created_by_name: 'Test User',
      },
    ],
  }),
};

/**
 * Mocks the version diff API module
 */
export function mockVersionDiffAPIModule() {
  vi.mock('@/lib/api/version-diff', () => mockVersionDiffAPI);
  return mockVersionDiffAPI;
}

// ============================================================================
// Comprehensive Mock Setup
// ============================================================================

/**
 * Sets up all API mocks for component testing
 */
export function setupAllAPIMocks() {
  mockAnnotationsAPIModule();
  mockProjectsAPIModule();
  mockClassesAPIModule();
  mockImageLocksAPIModule();
  mockExportAPIModule();
  mockVersionDiffAPIModule();

  return {
    annotations: mockAnnotationsAPI,
    projects: mockProjectsAPI,
    classes: mockClassesAPI,
    imageLocks: mockImageLocksAPI,
    export: mockExportAPI,
    versionDiff: mockVersionDiffAPI,
  };
}

/**
 * Resets all API mocks
 */
export function resetAllAPIMocks() {
  Object.values(mockAnnotationsAPI).forEach((mock) => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    }
  });

  Object.values(mockProjectsAPI).forEach((mock) => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    }
  });

  Object.values(mockClassesAPI).forEach((mock) => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    }
  });

  Object.values(mockImageLocksAPI.imageLockAPI).forEach((mock) => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    }
  });

  Object.values(mockExportAPI).forEach((mock) => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    }
  });

  Object.values(mockVersionDiffAPI).forEach((mock) => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    }
  });
}

// ============================================================================
// Response Builders
// ============================================================================

/**
 * Creates a mock API error response
 */
export function createMockAPIError(
  message = 'API Error',
  status = 500
): Error {
  const error = new Error(message);
  (error as any).status = status;
  return error;
}

/**
 * Creates a mock paginated response
 */
export function createMockPaginatedResponse<T>(
  items: T[],
  total: number,
  page = 1,
  pageSize = 10
) {
  return {
    items,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  };
}

/**
 * Creates a mock success response
 */
export function createMockSuccessResponse<T>(data: T) {
  return {
    success: true,
    data,
  };
}

/**
 * Creates a mock error response
 */
export function createMockErrorResponse(
  message: string,
  code = 'ERROR'
) {
  return {
    success: false,
    error: {
      message,
      code,
    },
  };
}
