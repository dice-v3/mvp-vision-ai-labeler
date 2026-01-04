# Add unit tests for API endpoints and major components

## Overview

Backend has only 8 test files, none of which test the 14 API endpoint modules (datasets, annotations, projects, etc.). Frontend has 13 test files, but they only cover annotation hooks/utils. Major components like Canvas.tsx (1,420 lines), ImageList.tsx (607 lines), and RightPanel.tsx (668 lines) have no tests.

## Rationale

API endpoints and UI components are critical integration points. Without tests, refactoring becomes risky, regressions go unnoticed, and developers lose confidence making changes. The existing tests for hooks are good, but the components that use them and the backend APIs they call are untested.

---
*This spec was created from ideation and is pending detailed specification.*
