# Vision AI Labeler - Frontend

This is a [Next.js](https://nextjs.org) project for a computer vision annotation platform, built with TypeScript, React, and Zustand for state management.

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Testing

### Running Tests

The frontend uses [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/react) for comprehensive component testing.

```bash
# Run all tests once
npm test

# Run tests in watch mode (during development)
npm run test:watch

# Run tests with interactive UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Test Coverage

Current test coverage includes:

- **Canvas Component** (239+ tests) - Annotation canvas with drawing, zoom/pan, and editing
- **ImageList Component** (300+ tests) - Image grid/list with filtering and navigation
- **RightPanel Component** (188+ tests) - Annotation list, editing, and class management
- **Annotation Utils & Hooks** (125+ tests) - Core annotation utilities and custom hooks
- **Canvas UI Components** (70+ tests) - Overlay components, toolbars, and controls

**Total**: 441 tests across 24 test files

Coverage thresholds are set to **70%** for lines, functions, branches, and statements.

### Writing Tests

See [TESTING.md](./TESTING.md) for comprehensive testing guidelines, patterns, and best practices.

#### Quick Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMockAnnotationStore } from '@/lib/test-utils';

describe('MyComponent', () => {
  it('should render correctly', () => {
    const mockStore = createMockAnnotationStore();

    render(<MyComponent />);

    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Test Utilities

The project includes comprehensive test utilities in `lib/test-utils/`:

- **mock-stores.ts** - Factory functions for Zustand store mocks
- **mock-api.ts** - Mock API responses and builders
- **component-test-utils.ts** - Component rendering helpers and utilities

```typescript
import {
  createMockAnnotationStore,
  createMockProject,
  createMockImage,
  createMockAnnotation,
} from '@/lib/test-utils';
```

## Project Structure

```
frontend/
├── app/                      # Next.js app router pages
├── components/               # React components
│   ├── annotation/          # Annotation-specific components
│   │   ├── Canvas.tsx       # Main annotation canvas
│   │   ├── ImageList.tsx    # Image list/grid component
│   │   ├── RightPanel.tsx   # Annotation panel
│   │   └── __tests__/       # Component tests
│   └── ui/                  # Reusable UI components
├── lib/                      # Utilities and libraries
│   ├── annotation/          # Annotation logic
│   │   ├── hooks/           # Custom React hooks
│   │   ├── tools/           # Annotation drawing tools
│   │   └── utils/           # Annotation utilities
│   ├── api/                 # API client functions
│   ├── stores/              # Zustand state stores
│   └── test-utils/          # Testing utilities
└── vitest.config.ts         # Vitest configuration
```

## Key Technologies

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Zustand** - State management
- **React Query** - Server state management
- **Tailwind CSS** - Utility-first CSS framework
- **Vitest** - Fast unit test framework
- **React Testing Library** - Component testing utilities

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)

## Contributing

When contributing to the frontend:

1. **Write tests** for new components and features
2. **Follow existing patterns** in component structure and testing
3. **Maintain coverage** at or above 70% for new code
4. **Run tests before committing**: `npm test`
5. **Check code style**: `npm run lint`

See [TESTING.md](./TESTING.md) for detailed testing guidelines.
