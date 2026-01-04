# Testing Guide - Vision AI Labeler

This document provides an overview of testing practices for the Vision AI Labeler project, covering both backend and frontend testing.

## Overview

The Vision AI Labeler project maintains comprehensive test coverage for both backend API endpoints and frontend components:

- **Backend**: 1,000+ tests covering 15 API endpoint modules
- **Frontend**: 441 tests covering major components and utilities
- **Coverage Target**: 70%+ for all code

## Quick Start

### Backend Tests

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install pytest pytest-asyncio pytest-cov

# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=app --cov-report=html
```

### Frontend Tests

```bash
cd frontend
npm install

# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

## Test Coverage Summary

### Backend API Endpoints

| Module | Tests | Status |
|--------|-------|--------|
| Authentication | 12 | ✅ Complete |
| Users | 54 | ✅ Complete |
| Projects | 85+ | ✅ Complete |
| Project Permissions | 38 | ✅ Complete |
| Project Classes | 48 | ✅ Complete |
| Datasets | 94 | ✅ Complete |
| Platform Datasets | 40 | ✅ Complete |
| Admin Datasets | 41 | ✅ Complete |
| Annotations | 52 | ✅ Complete |
| Image Locks | 60+ | ✅ Complete |
| Version Diff | 60+ | ✅ Complete |
| Export | 60+ | ✅ Complete |
| Invitations | 70+ | ✅ Complete |
| Admin Stats | 48 | ✅ Complete |
| Admin Audit | 60+ | ✅ Complete |

### Frontend Components

| Component | Tests | Status |
|-----------|-------|--------|
| Canvas | 239+ | ✅ Complete |
| ImageList | 300+ | ✅ Complete |
| RightPanel | 188+ | ✅ Complete |
| Annotation Utils | 125+ | ✅ Complete |
| Canvas UI | 70+ | ✅ Complete |

## Testing Frameworks

### Backend

- **pytest** - Python testing framework
- **pytest-asyncio** - Async test support
- **FastAPI TestClient** - HTTP client for API testing
- **SQLAlchemy** - Database ORM with test fixtures

### Frontend

- **Vitest** - Fast unit test framework
- **React Testing Library** - Component testing
- **@testing-library/user-event** - User interaction simulation
- **happy-dom** - Lightweight DOM implementation

## Detailed Testing Guides

For comprehensive testing patterns, best practices, and examples:

### Backend Testing

📖 **[Backend Testing Guide](./backend/TESTING.md)**

Topics covered:
- API endpoint testing patterns
- Authentication and permission testing
- Database testing with fixtures
- CRUD operation testing
- Error handling and edge cases
- Mocking external services
- Pagination and filtering
- Batch operations
- Optimistic locking

Quick reference:
- [Backend Tests README](./backend/tests/README.md) - Quick start and fixtures
- [Backend TESTING.md](./backend/TESTING.md) - Comprehensive patterns

### Frontend Testing

📖 **[Frontend Testing Guide](./frontend/TESTING.md)**

Topics covered:
- Component testing patterns
- Module hoisting with vi.hoisted()
- Testing user interactions
- Async operations and state
- Mock stores and API responses
- Canvas and mouse events
- Testing with timers
- Accessibility testing
- Edge cases and error handling

Quick reference:
- [Frontend README](./frontend/README.md) - Project overview and testing section
- [Frontend TESTING.md](./frontend/TESTING.md) - Comprehensive patterns
- [Frontend Test Status](./frontend/TEST_STATUS.md) - Current test status

## Testing Best Practices

### General Principles

1. **Write tests first** - TDD when possible
2. **Test behavior, not implementation** - Focus on what, not how
3. **Keep tests independent** - No test should depend on another
4. **Use descriptive names** - Test names should explain what they test
5. **Follow AAA pattern** - Arrange, Act, Assert
6. **Test edge cases** - Empty states, errors, boundaries
7. **Maintain coverage** - 70%+ for all new code

### Backend Best Practices

- ✅ Use fixtures for common setup
- ✅ Test all authentication scenarios
- ✅ Test permission checks (RBAC)
- ✅ Test database constraints
- ✅ Mock external services (S3, Redis, etc.)
- ✅ Test pagination and filtering
- ✅ Verify error responses

### Frontend Best Practices

- ✅ Use vi.hoisted() for mock constants
- ✅ Test user interactions with userEvent
- ✅ Use semantic queries (getByRole, getByLabelText)
- ✅ Test loading, error, and empty states
- ✅ Mock stores and API calls
- ✅ Test accessibility
- ✅ Keep tests fast and focused

## Running Tests in CI/CD

### Backend CI

```yaml
# Example GitHub Actions workflow
- name: Run backend tests
  run: |
    cd backend
    pip install -r requirements.txt
    pip install pytest pytest-asyncio pytest-cov
    pytest tests/ --cov=app --cov-report=xml

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage.xml
```

### Frontend CI

```yaml
# Example GitHub Actions workflow
- name: Run frontend tests
  run: |
    cd frontend
    npm ci
    npm test -- --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/coverage-final.json
```

## Test Utilities

### Backend Test Utilities

Available in `backend/tests/fixtures/`:

- **conftest.py** - Main pytest configuration
- **auth_fixtures.py** - Authentication mocks
- **db_fixtures.py** - Database fixtures and factories

Key fixtures:
- `authenticated_client` - TestClient with auth
- `admin_client` - TestClient with admin auth
- `create_dataset` - Dataset factory
- `create_project` - Project factory
- `create_annotation` - Annotation factory

### Frontend Test Utilities

Available in `frontend/lib/test-utils/`:

- **mock-stores.ts** - Zustand store mocks
- **mock-api.ts** - API response builders
- **component-test-utils.ts** - Rendering helpers

Key utilities:
- `createMockAnnotationStore()` - Mock annotation store
- `createMockProject()` - Project factory
- `createMockImage()` - Image factory
- `createMockAnnotation()` - Annotation factory
- `renderWithProviders()` - Render with context

## Coverage Reports

### Viewing Coverage Reports

**Backend:**
```bash
cd backend
pytest tests/ --cov=app --cov-report=html
open htmlcov/index.html  # macOS
# or
xdg-open htmlcov/index.html  # Linux
```

**Frontend:**
```bash
cd frontend
npm run test:coverage
open coverage/index.html  # macOS
# or
xdg-open coverage/index.html  # Linux
```

### Coverage Thresholds

Both backend and frontend maintain **70%+ coverage** for:
- Lines
- Functions
- Branches
- Statements

## Troubleshooting

### Backend Issues

**PostgreSQL ARRAY Type Errors**
- Some models use PostgreSQL ARRAY types
- Use PostgreSQL for complete test execution
- See [Backend TESTING.md](./backend/TESTING.md#troubleshooting)

**Fixture Not Found**
- Check fixture is in conftest.py
- Verify import paths
- Check fixture scope

### Frontend Issues

**Module Hoisting Errors**
- Use `vi.hoisted()` pattern for mock constants
- See [Frontend TESTING.md](./frontend/TESTING.md#troubleshooting)

**Act Warnings**
- Use `await waitFor()` for async updates
- Use `await user.click()` instead of `fireEvent.click()`

**Flaky Tests**
- Ensure proper cleanup in beforeEach/afterEach
- Use waitFor instead of setTimeout
- Mock time-based functions

## Contributing

When contributing to the project:

1. ✅ **Write tests** for all new features
2. ✅ **Follow existing patterns** in test structure
3. ✅ **Maintain coverage** at or above 70%
4. ✅ **Run tests locally** before pushing
5. ✅ **Update documentation** if introducing new patterns

### Pre-commit Checklist

- [ ] All tests pass: `pytest tests/` (backend) or `npm test` (frontend)
- [ ] Coverage meets threshold: `--cov-report=html` or `npm run test:coverage`
- [ ] No console.log or debugging code
- [ ] Test names are descriptive
- [ ] Edge cases are covered
- [ ] Documentation is updated

## Resources

### Testing Guides
- [Backend Testing Guide](./backend/TESTING.md)
- [Frontend Testing Guide](./frontend/TESTING.md)
- [Backend Tests README](./backend/tests/README.md)
- [Frontend README](./frontend/README.md)

### External Documentation
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [Pytest Documentation](https://docs.pytest.org/)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Support

For questions about testing:

1. Check the relevant testing guide (backend or frontend)
2. Review existing test files for patterns
3. See troubleshooting sections in the testing guides
4. Ask in the team chat or create an issue

---

**Last Updated**: 2026-01-04
**Backend Tests**: 1,000+ tests across 15 API modules
**Frontend Tests**: 441 tests across 24 test files
**Coverage Target**: 70%+ for all metrics
