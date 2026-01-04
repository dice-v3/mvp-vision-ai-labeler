/**
 * Component Test Utilities
 *
 * Provides rendering helpers and utilities for testing React components
 * with Zustand store support, React Query, and authentication context.
 */

import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

// ============================================================================
// Mock Auth Context
// ============================================================================

interface MockUser {
  id: number;
  email: string;
  name: string;
  role: string;
  sub?: string;
}

interface MockAuthContext {
  user: MockUser | null;
  loading: boolean;
  error: Error | null;
  logout: () => Promise<void>;
}

const defaultMockUser: MockUser = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  sub: 'test-user-sub',
};

const defaultAuthContext: MockAuthContext = {
  user: defaultMockUser,
  loading: false,
  error: null,
  logout: vi.fn().mockResolvedValue(undefined),
};

// Mock the auth context
vi.mock('@/lib/auth/context', () => ({
  useAuth: () => defaultAuthContext,
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));

// ============================================================================
// Test Wrapper
// ============================================================================

interface WrapperOptions {
  queryClient?: QueryClient;
  authContext?: Partial<MockAuthContext>;
}

/**
 * Creates a wrapper component with all required providers
 */
export function createWrapper(options: WrapperOptions = {}) {
  const {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    }),
  } = options;

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Custom Render
// ============================================================================

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  authContext?: Partial<MockAuthContext>;
}

/**
 * Custom render function that wraps components with necessary providers
 *
 * @example
 * const { getByText } = renderWithProviders(<MyComponent />);
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { queryClient, authContext, ...renderOptions } = options;

  const wrapper = createWrapper({ queryClient, authContext });

  return {
    ...render(ui, { wrapper, ...renderOptions }),
    queryClient,
  };
}

// ============================================================================
// Canvas Test Helpers
// ============================================================================

/**
 * Creates a mock canvas element with necessary methods
 */
export function createMockCanvas(width = 800, height = 600) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  return canvas;
}

/**
 * Creates a mock image element
 */
export function createMockImage(
  src = 'http://example.com/image.jpg',
  width = 800,
  height = 600
): HTMLImageElement {
  const img = new Image();
  img.src = src;
  img.width = width;
  img.height = height;

  // Simulate image load
  setTimeout(() => {
    img.dispatchEvent(new Event('load'));
  }, 0);

  return img;
}

/**
 * Creates a mock mouse event
 */
export function createMouseEvent(
  type: string,
  options: Partial<MouseEvent> = {}
): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: 0,
    clientY: 0,
    button: 0,
    ...options,
  });
}

/**
 * Creates a mock wheel event
 */
export function createWheelEvent(
  deltaY: number,
  options: Partial<WheelEvent> = {}
): WheelEvent {
  return new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    view: window,
    deltaY,
    ...options,
  });
}

/**
 * Creates a mock keyboard event
 */
export function createKeyboardEvent(
  type: string,
  key: string,
  options: Partial<KeyboardEvent> = {}
): KeyboardEvent {
  return new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    key,
    ...options,
  });
}

// ============================================================================
// Store Test Helpers
// ============================================================================

/**
 * Waits for store state to update
 */
export async function waitForStoreUpdate(
  checkFn: () => boolean,
  timeout = 1000
): Promise<void> {
  const startTime = Date.now();

  while (!checkFn()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for store update');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Checks if a point is inside a bounding box
 */
export function isPointInBbox(
  point: { x: number; y: number },
  bbox: [number, number, number, number]
): boolean {
  const [x, y, width, height] = bbox;
  return (
    point.x >= x &&
    point.x <= x + width &&
    point.y >= y &&
    point.y <= y + height
  );
}

/**
 * Checks if two bounding boxes overlap
 */
export function doBboxesOverlap(
  bbox1: [number, number, number, number],
  bbox2: [number, number, number, number]
): boolean {
  const [x1, y1, w1, h1] = bbox1;
  const [x2, y2, w2, h2] = bbox2;

  return !(x1 + w1 < x2 || x2 + w2 < x1 || y1 + h1 < y2 || y2 + h2 < y1);
}

/**
 * Calculates distance between two points
 */
export function distanceBetweenPoints(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================================================
// Export mock user and auth context for tests
// ============================================================================

export { defaultMockUser, defaultAuthContext };
export type { MockUser, MockAuthContext };

// Re-export testing library utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
