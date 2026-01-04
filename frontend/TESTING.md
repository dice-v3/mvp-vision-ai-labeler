# Frontend Testing Guide

This document provides comprehensive guidelines for writing and maintaining tests in the Vision AI Labeler frontend application.

## Table of Contents

- [Overview](#overview)
- [Testing Stack](#testing-stack)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Testing Patterns](#testing-patterns)
- [Best Practices](#best-practices)
- [Common Scenarios](#common-scenarios)
- [Troubleshooting](#troubleshooting)

## Overview

The frontend uses a comprehensive testing approach with:

- **441 tests** across 24 test files
- **70% coverage threshold** for all metrics (lines, functions, branches, statements)
- Focus on major components: Canvas, ImageList, RightPanel
- Extensive test utilities for mocking and helpers

### Test Coverage

| Component | Tests | Files | Coverage |
|-----------|-------|-------|----------|
| Canvas | 239+ | 4 | Core rendering, drawing, transforms, selection |
| ImageList | 300+ | 3 | Rendering, filtering, state management |
| RightPanel | 188+ | 3 | Annotation list, editing, class management |
| Utils & Hooks | 125+ | 14 | Annotation utilities and custom hooks |
| **Total** | **441+** | **24** | **Comprehensive** |

## Testing Stack

### Core Tools

- **[Vitest](https://vitest.dev/)** (v4.0.16) - Fast unit test framework with native TypeScript support
- **[React Testing Library](https://testing-library.com/react)** (v16.3.1) - Component testing utilities
- **[@testing-library/user-event](https://testing-library.com/docs/user-event/intro)** (v14.6.1) - User interaction simulation
- **[happy-dom](https://github.com/capricorn86/happy-dom)** (v20.0.11) - Lightweight DOM implementation

### Coverage & Reporting

- **[@vitest/coverage-v8](https://vitest.dev/guide/coverage.html)** (v4.0.16) - Code coverage reporter
- **[@vitest/ui](https://vitest.dev/guide/ui.html)** (v4.0.16) - Interactive test UI

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode (during development)
npm run test:watch

# Interactive UI
npm run test:ui

# With coverage report
npm run test:coverage
```

### Coverage Reports

After running `npm run test:coverage`, open `coverage/index.html` to view the detailed coverage report.

## Test Structure

### Directory Organization

```
frontend/
├── components/
│   ├── annotation/
│   │   ├── Canvas.tsx
│   │   ├── ImageList.tsx
│   │   ├── RightPanel.tsx
│   │   └── __tests__/
│   │       ├── Canvas.test.tsx
│   │       ├── Canvas-drawing.test.tsx
│   │       ├── Canvas-transforms.test.tsx
│   │       ├── Canvas-selection.test.tsx
│   │       ├── ImageList.test.tsx
│   │       ├── ImageList-filters.test.tsx
│   │       ├── ImageList-state.test.tsx
│   │       ├── RightPanel.test.tsx
│   │       ├── RightPanel-editing.test.tsx
│   │       └── RightPanel-classes.test.tsx
│   └── ui/
│       └── __tests__/
├── lib/
│   ├── annotation/
│   │   ├── hooks/
│   │   │   └── __tests__/
│   │   ├── tools/
│   │   │   └── __tests__/
│   │   └── utils/
│   │       └── __tests__/
│   └── test-utils/
│       ├── component-test-utils.ts
│       ├── mock-stores.ts
│       ├── mock-api.ts
│       ├── index.ts
│       └── __tests__/
│           └── test-utils.test.ts
└── vitest.config.ts
```

### Test File Naming

- Component tests: `ComponentName.test.tsx`
- Feature-specific tests: `ComponentName-feature.test.tsx`
- Utility tests: `utilityName.test.ts`
- Hook tests: `useHookName.test.ts`

## Testing Patterns

### 1. Component Testing Pattern

```typescript
/**
 * Component Tests - Feature Name
 *
 * Description of what this test file covers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from '../MyComponent';
import { createMockAnnotationStore } from '@/lib/test-utils';

// Use vi.hoisted() for mock constants used in vi.mock()
const { mockUseAnnotationStore } = vi.hoisted(() => ({
  mockUseAnnotationStore: vi.fn(),
}));

vi.mock('@/lib/stores/annotationStore', () => ({
  useAnnotationStore: mockUseAnnotationStore,
}));

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Feature Group', () => {
    it('should do something specific', () => {
      // Arrange
      const mockStore = createMockAnnotationStore();
      mockUseAnnotationStore.mockReturnValue(mockStore);

      // Act
      render(<MyComponent />);

      // Assert
      expect(screen.getByText('Expected Text')).toBeInTheDocument();
    });
  });
});
```

### 2. Module Hoisting Pattern

**IMPORTANT**: When using mock constants in `vi.mock()`, always use `vi.hoisted()`:

```typescript
// ❌ WRONG - Will cause hoisting errors
const mockFn = vi.fn();

vi.mock('@/some/module', () => ({
  someExport: mockFn, // Error: mockFn not hoisted
}));

// ✅ CORRECT - Use vi.hoisted()
const { mockFn } = vi.hoisted(() => ({
  mockFn: vi.fn(),
}));

vi.mock('@/some/module', () => ({
  someExport: mockFn, // Works correctly
}));
```

### 3. Testing with User Interactions

```typescript
import userEvent from '@testing-library/user-event';

it('should handle user interactions', async () => {
  const user = userEvent.setup();
  const mockStore = createMockAnnotationStore();

  render(<MyComponent />);

  // Click interactions
  await user.click(screen.getByRole('button', { name: 'Submit' }));

  // Type interactions
  await user.type(screen.getByRole('textbox'), 'Hello World');

  // Keyboard interactions
  await user.keyboard('{Escape}');
  await user.keyboard('{Control>}s{/Control}');

  // Verify state changes
  expect(mockStore.someAction).toHaveBeenCalled();
});
```

### 4. Testing Async Operations

```typescript
import { waitFor } from '@testing-library/react';

it('should handle async operations', async () => {
  const mockAPI = vi.fn().mockResolvedValue({ data: 'success' });

  render(<MyComponent />);

  await user.click(screen.getByRole('button'));

  await waitFor(() => {
    expect(screen.getByText('success')).toBeInTheDocument();
  });

  expect(mockAPI).toHaveBeenCalledWith({ id: '123' });
});
```

### 5. Testing with Mock Stores

```typescript
import {
  createMockAnnotationStore,
  createMockProject,
  createMockImage,
  createMockAnnotation,
} from '@/lib/test-utils';

it('should use store data correctly', () => {
  const mockProject = createMockProject({ name: 'Test Project' });
  const mockImage = createMockImage({ file_name: 'test.jpg' });
  const mockAnnotation = createMockAnnotation({
    annotation_type: 'bbox',
  });

  const mockStore = createMockAnnotationStore({
    project: mockProject,
    currentImage: mockImage,
    annotations: [mockAnnotation],
  });

  mockUseAnnotationStore.mockReturnValue(mockStore);

  render(<MyComponent />);

  expect(screen.getByText('Test Project')).toBeInTheDocument();
});
```

### 6. Testing Canvas/Mouse Events

```typescript
import { fireEvent } from '@testing-library/react';
import { createMouseEvent } from '@/lib/test-utils';

it('should handle canvas mouse events', () => {
  render(<Canvas />);

  const canvas = screen.getByRole('img'); // Canvas element

  // Mouse down
  fireEvent.mouseDown(canvas, createMouseEvent('mousedown', 100, 200));

  // Mouse move
  fireEvent.mouseMove(canvas, createMouseEvent('mousemove', 150, 250));

  // Mouse up
  fireEvent.mouseUp(canvas, createMouseEvent('mouseup', 150, 250));

  // Verify drawing occurred
  expect(mockStore.addAnnotation).toHaveBeenCalled();
});
```

### 7. Testing with Timers

```typescript
import { vi } from 'vitest';

it('should handle timers correctly', () => {
  vi.useFakeTimers();

  render(<MyComponent />);

  // Fast-forward time by 1000ms
  vi.advanceTimersByTime(1000);

  expect(mockCallback).toHaveBeenCalled();

  vi.useRealTimers();
});
```

## Best Practices

### 1. Test Organization

- **Group related tests** using `describe()` blocks
- **Use descriptive test names** that explain what is being tested
- **One assertion per test** (or related assertions for one concept)
- **Follow AAA pattern**: Arrange, Act, Assert

```typescript
describe('ImageList', () => {
  describe('Filtering', () => {
    it('should filter by status when filter is selected', () => {
      // Arrange - Setup test data
      const mockStore = createMockAnnotationStore();

      // Act - Perform the action
      render(<ImageList />);
      user.click(screen.getByRole('button', { name: 'Filter' }));

      // Assert - Verify the result
      expect(screen.getByText('Filtered')).toBeInTheDocument();
    });
  });
});
```

### 2. Mock Management

- **Clear mocks before each test**: Use `beforeEach(() => vi.clearAllMocks())`
- **Mock at the right level**: Mock dependencies, not implementation details
- **Use factory functions** for consistent test data

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

### 3. Accessibility Testing

Use semantic queries to encourage accessible components:

```typescript
// ✅ GOOD - Accessible queries
screen.getByRole('button', { name: 'Submit' })
screen.getByLabelText('Email')
screen.getByText('Welcome')

// ❌ AVOID - Fragile queries
screen.getByTestId('submit-btn')
screen.getByClassName('email-input')
```

### 4. Testing Edge Cases

Always test:
- **Empty states** (no data, empty arrays)
- **Error states** (API failures, validation errors)
- **Loading states** (async operations in progress)
- **Boundary values** (min/max, 0, negative numbers)

```typescript
describe('Edge Cases', () => {
  it('should handle empty annotations array', () => {
    const mockStore = createMockAnnotationStore({ annotations: [] });
    render(<AnnotationList />);
    expect(screen.getByText('No annotations')).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    mockAPI.mockRejectedValue(new Error('Network error'));
    render(<MyComponent />);
    await user.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
    });
  });
});
```

### 5. Avoid Testing Implementation Details

Test **what** the component does, not **how** it does it:

```typescript
// ❌ AVOID - Testing implementation
expect(component.state.count).toBe(5);

// ✅ GOOD - Testing behavior
expect(screen.getByText('Count: 5')).toBeInTheDocument();
```

### 6. Keep Tests Fast

- Use `happy-dom` instead of `jsdom` (already configured)
- Mock expensive operations (API calls, complex calculations)
- Avoid unnecessary `waitFor()` calls
- Use `userEvent.setup()` once per test

### 7. Snapshot Testing (Use Sparingly)

```typescript
import { render } from '@testing-library/react';

it('should match snapshot', () => {
  const { container } = render(<MyComponent />);
  expect(container.firstChild).toMatchSnapshot();
});
```

**Note**: Snapshots are brittle. Prefer specific assertions.

## Common Scenarios

### Testing Forms

```typescript
it('should submit form with valid data', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();

  render(<MyForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText('Name'), 'John Doe');
  await user.type(screen.getByLabelText('Email'), 'john@example.com');
  await user.click(screen.getByRole('button', { name: 'Submit' }));

  expect(onSubmit).toHaveBeenCalledWith({
    name: 'John Doe',
    email: 'john@example.com',
  });
});
```

### Testing Lists/Grids

```typescript
it('should render all items in the list', () => {
  const items = createMockImages(5);
  const mockStore = createMockAnnotationStore({ images: items });

  render(<ImageList />);

  items.forEach((item) => {
    expect(screen.getByText(item.file_name)).toBeInTheDocument();
  });
});
```

### Testing Modal/Dialog

```typescript
it('should open and close modal', async () => {
  const user = userEvent.setup();

  render(<MyComponent />);

  // Modal initially closed
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  // Open modal
  await user.click(screen.getByRole('button', { name: 'Open' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();

  // Close modal
  await user.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
```

### Testing Keyboard Shortcuts

```typescript
it('should trigger action on keyboard shortcut', async () => {
  const user = userEvent.setup();
  const mockStore = createMockAnnotationStore();

  render(<Canvas />);

  // Press Ctrl+S or Cmd+S
  await user.keyboard('{Control>}s{/Control}');

  expect(mockStore.saveAnnotation).toHaveBeenCalled();
});
```

### Testing Conditional Rendering

```typescript
it('should show loading state while fetching', () => {
  const mockStore = createMockAnnotationStore({ loading: true });

  render(<MyComponent />);

  expect(screen.getByText('Loading...')).toBeInTheDocument();
  expect(screen.queryByText('Content')).not.toBeInTheDocument();
});

it('should show content when loaded', () => {
  const mockStore = createMockAnnotationStore({ loading: false });

  render(<MyComponent />);

  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  expect(screen.getByText('Content')).toBeInTheDocument();
});
```

## Troubleshooting

### Module Hoisting Errors

**Error**: "ReferenceError: Cannot access 'mockFn' before initialization"

**Solution**: Use `vi.hoisted()` pattern (see [Module Hoisting Pattern](#2-module-hoisting-pattern))

### Act Warnings

**Warning**: "Warning: An update to Component inside a test was not wrapped in act(...)."

**Solution**:
1. Use `await waitFor()` for async updates
2. Use `await user.click()` instead of `fireEvent.click()`
3. Wrap state updates in `act()` if necessary

```typescript
import { act } from '@testing-library/react';

await act(async () => {
  // State updates
});
```

### Tests Timing Out

**Issue**: Tests take too long or timeout

**Solutions**:
1. Check for missing `await` on async operations
2. Verify mock API calls are configured correctly
3. Use `vi.useFakeTimers()` for timer-based code
4. Increase timeout for specific tests:

```typescript
it('slow test', async () => {
  // ... test code
}, 10000); // 10 second timeout
```

### Flaky Tests

**Issue**: Tests pass/fail randomly

**Solutions**:
1. Ensure proper cleanup with `beforeEach`/`afterEach`
2. Avoid relying on timing (use `waitFor` instead of `setTimeout`)
3. Mock random/time-based functions
4. Check for race conditions in async code

### Mock Not Working

**Issue**: Mock function not being called

**Solutions**:
1. Verify mock is set up before component renders
2. Check mock path matches import path exactly
3. Use `vi.clearAllMocks()` in `beforeEach`
4. Verify mock is returned from store/context

```typescript
// Debug: Log mock calls
console.log(mockFn.mock.calls);
```

## Test Utilities Reference

### Mock Stores

```typescript
import {
  createMockAnnotationStore,
  createMockProject,
  createMockImage,
  createMockAnnotation,
  createMockClass,
  createMockAnnotations,
  createMockImages,
} from '@/lib/test-utils';
```

### Mock API

```typescript
import {
  createMockAPIResponse,
  createMockErrorResponse,
  createMockPaginatedResponse,
  setupAllAPIMocks,
  resetAllAPIMocks,
} from '@/lib/test-utils';
```

### Component Utilities

```typescript
import {
  renderWithProviders,
  createMockCanvas,
  createMouseEvent,
  createWheelEvent,
  createKeyboardEvent,
  pointInBbox,
  bboxOverlap,
  distance,
} from '@/lib/test-utils';
```

## Coverage Goals

| Metric | Threshold | Target |
|--------|-----------|--------|
| Lines | 70% | 80%+ |
| Functions | 70% | 80%+ |
| Branches | 70% | 75%+ |
| Statements | 70% | 80%+ |

**Priority Areas**:
- ✅ Canvas component (core rendering, drawing, transforms)
- ✅ ImageList component (rendering, filtering, state)
- ✅ RightPanel component (annotation list, editing, classes)
- 🎯 Annotation utilities and hooks
- 🎯 Canvas UI components

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Frontend Test Status](./TEST_STATUS.md)
- [Frontend Tests Summary](./FRONTEND_TESTS_SUMMARY.md)

## Contributing

When adding new features:

1. ✅ Write tests for new components/functions
2. ✅ Follow existing test patterns
3. ✅ Maintain 70%+ coverage
4. ✅ Run tests before committing: `npm test`
5. ✅ Update this guide if introducing new patterns

---

**Last Updated**: 2026-01-04
**Test Count**: 441 tests across 24 files
**Coverage**: 70%+ target for all metrics
