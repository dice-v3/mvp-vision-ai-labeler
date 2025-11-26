# Phase 15: Admin Dashboard & System Audit

**Created**: 2025-11-26
**Status**: ⏸️ Pending
**Priority**: High (Production readiness)
**Duration**: 2-3 weeks (60-75h)

---

## Overview

Phase 15에서는 시스템 관리자를 위한 포괄적인 관리 기능을 구축합니다. 데이터셋 현황, 사용자 활동, 시스템 리소스를 모니터링하고, 전체 시스템 사용에 대한 audit trail을 제공하여 프로덕션 환경에서의 운영 효율성과 보안을 강화합니다.

**Key Features**:
- 📊 **Admin Dashboard**: 데이터셋 현황, 레이블링 진행도, 사용자 통계
- 📝 **Audit Log System**: 모든 시스템 작업에 대한 상세 로그 및 추적
- 📈 **System Statistics**: 사용자 활동, 리소스 사용량, 성능 메트릭

---

## Business Requirements

### 1. 관리자 권한 필요성

**Use Cases**:
- 데이터셋 관리자: 전체 프로젝트 현황 파악, 병목 지점 발견
- 시스템 관리자: 사용자 활동 모니터링, 보안 이슈 추적
- 팀 리더: 팀원별 작업량 및 진행도 확인

**Pain Points (현재 상태)**:
- ❌ 전체 데이터셋 현황을 한눈에 볼 수 없음
- ❌ 누가 언제 무엇을 했는지 추적 불가
- ❌ 시스템 리소스 사용량을 알 수 없음
- ❌ 사용자 활동 패턴 분석 불가

---

## Architecture

### UI Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar                  │  Main Content Area               │
│                           │                                   │
│  [Datasets]               │  ┌─────────────────────────────┐ │
│  [Projects]               │  │                             │ │
│  ...                      │  │   Selected Dashboard        │ │
│                           │  │   (Dataset / Audit / Stats) │ │
│  ────────────────          │  │                             │ │
│  [📊 Dataset Manager]     │  └─────────────────────────────┘ │
│  [📝 System Logs]         │                                   │
│  [📈 System Stats]        │                                   │
│  ────────────────          │                                   │
│  [User Profile]           │                                   │
│  [Logout]                 │                                   │
└─────────────────────────────────────────────────────────────┘
```

**Sidebar Menu Addition**:
- 기존 사용자 정보 위에 3개 관리자 메뉴 추가
- 권한에 따라 메뉴 표시 여부 결정 (admin/owner만)
- 클릭 시 우측 작업 영역에 해당 대시보드 렌더링

### Database Schema

**IMPORTANT CONSTRAINT**: UserDB는 플랫폼팀 소유로 수정 불가. 모든 새 테이블은 **Labeler DB**에 생성.

**New Tables** (Labeler DB):

```sql
-- Audit Log Table (Labeler DB) ← UPDATED
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,  -- 'create', 'update', 'delete', 'login', 'logout', etc.
    resource_type VARCHAR(50),     -- 'dataset', 'project', 'annotation', 'user', etc.
    resource_id VARCHAR(255),      -- ID of the affected resource
    details JSONB,                 -- Additional context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    status VARCHAR(20),            -- 'success', 'failure', 'error'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- User Session Tracking (Labeler DB) ← UPDATED
CREATE TABLE user_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    login_at TIMESTAMP NOT NULL,
    logout_at TIMESTAMP,
    last_activity_at TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    duration_seconds INTEGER,  -- Calculated on logout
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_login_at ON user_sessions(login_at DESC);

-- System Statistics Cache (Labeler DB)
CREATE TABLE system_stats_cache (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value JSONB NOT NULL,
    calculated_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_system_stats_metric ON system_stats_cache(metric_name);
CREATE INDEX idx_system_stats_expires ON system_stats_cache(expires_at);
```

---

## Phase 15.1: Admin Dashboard - Dataset Manager (18-22h)

**Goal**: 전체 데이터셋 현황을 한눈에 파악하고 관리

### 15.1.1 Backend API (8-10h)

**15.1.1.1 Dataset Overview API** (3-4h)
- [x] `GET /api/v1/admin/datasets/overview`
  - Response:
    ```json
    {
      "total_datasets": 42,
      "total_images": 125430,
      "total_size_bytes": 52428800000,
      "total_annotations": 543210,
      "datasets_by_status": {
        "active": 35,
        "completed": 5,
        "archived": 2
      },
      "recent_updates": [
        {
          "dataset_id": "ds_123",
          "name": "zipper_defects",
          "last_updated": "2025-11-26T14:30:00Z",
          "updated_by": "user@example.com"
        }
      ]
    }
    ```

**15.1.1.2 Dataset Detail API** (2-3h)
- [ ] `GET /api/v1/admin/datasets/{id}/details`
  - Dataset metadata
  - Associated projects
  - User permissions
  - Annotation progress by task type
  - Recent activity timeline

**15.1.1.3 Labeling Progress API** (3-4h)
- [ ] `GET /api/v1/admin/datasets/{id}/progress`
  - Images by status (not-started, in-progress, completed)
  - Annotations by task type
  - Completion rate trends (daily/weekly)
  - User contribution breakdown
  - Average labeling time per image

### 15.1.2 Frontend Dashboard (10-12h)

**15.1.2.1 Dataset Manager Page** (4-5h)
- [ ] Create `frontend/app/admin/datasets/page.tsx`
- [ ] Dataset overview cards:
  - Total datasets
  - Total images
  - Total storage used
  - Active users
- [ ] Dataset list with filters:
  - Filter by status (active/completed/archived)
  - Search by name
  - Sort by size/images/last_updated

**15.1.2.2 Dataset Detail View** (3-4h)
- [ ] Dataset info panel:
  - Basic metadata (name, owner, created_at)
  - Size and image count
  - Associated projects
- [ ] User permissions table:
  - List all users with access
  - Role badges (owner/admin/annotator/viewer)
  - Last activity timestamp
- [ ] Quick actions:
  - View annotations
  - Export dataset
  - Manage permissions

**15.1.2.3 Progress Visualization** (3h)
- [ ] Progress charts:
  - Completion rate pie chart
  - Daily annotation trend (line chart)
  - User contribution bar chart
- [ ] Interactive filters:
  - Date range selector
  - Task type filter
  - User filter

---

## Phase 15.2: Audit Log System (20-25h)

**Goal**: 모든 시스템 작업에 대한 추적 및 로그

### 15.2.1 Audit Logging Library Selection (2h)

**Recommended Libraries**:

**Option A: Python Audit Log** (Lightweight)
- Library: `python-audit-log` or custom implementation
- Pros: Full control, lightweight, async support
- Cons: More initial setup required

**Option B: Django-Auditlog** (If migrating to Django)
- Library: `django-auditlog`
- Pros: Mature, comprehensive, automatic tracking
- Cons: Django dependency

**Option C: SQLAlchemy-Continuum** (FastAPI compatible)
- Library: `sqlalchemy-continuum`
- Pros: Automatic model versioning, FastAPI compatible
- Cons: Complex setup

**Recommendation**: **Custom Implementation** (Option A)
- FastAPI middleware for automatic request logging
- SQLAlchemy event listeners for model changes
- Async logging for performance

### 15.2.2 Backend Implementation (10-12h)

**15.2.2.1 Audit Log Service** (4-5h)
- [ ] Create `backend/app/services/audit_service.py`
- [ ] Core functions:
  ```python
  async def log_action(
      user_id: int,
      action: str,
      resource_type: str,
      resource_id: str,
      details: dict = None,
      request: Request = None,
      status: str = "success"
  )

  async def log_login(user_id: int, request: Request)
  async def log_logout(user_id: int, session_id: str)
  async def log_create(user_id: int, resource_type: str, resource_id: str, data: dict)
  async def log_update(user_id: int, resource_type: str, resource_id: str, changes: dict)
  async def log_delete(user_id: int, resource_type: str, resource_id: str)
  ```

**15.2.2.2 Middleware Integration** (3-4h)
- [ ] Create `backend/app/middleware/audit_middleware.py`
- [ ] Automatic logging for:
  - All API requests (method, endpoint, user, IP)
  - Request/response duration
  - Error responses (4xx, 5xx)
- [ ] Exclude from logging:
  - Health check endpoints
  - Static assets
  - High-frequency polling endpoints (optional)

**15.2.2.3 Model Event Listeners** (3h)
- [ ] SQLAlchemy event listeners for:
  - `before_insert` → log_create
  - `before_update` → log_update
  - `before_delete` → log_delete
- [ ] Capture field-level changes (old_value → new_value)
- [ ] Models to track:
  - User, Dataset, Project, Annotation
  - ProjectPermission, Invitation
  - ImageAnnotationStatus

**15.2.2.4 Audit Log Query API** (2-3h)
- [ ] `GET /api/v1/admin/audit-logs`
  - Pagination (cursor-based)
  - Filters: user_id, action, resource_type, date_range
  - Full-text search on details
- [ ] `GET /api/v1/admin/audit-logs/{id}`
  - Single log detail
- [ ] `GET /api/v1/admin/audit-logs/export`
  - CSV/JSON export

### 15.2.3 Frontend Audit Log Viewer (8-10h)

**15.2.3.1 Audit Log Page** (4-5h)
- [ ] Create `frontend/app/admin/audit-logs/page.tsx`
- [ ] Log table with columns:
  - Timestamp (sortable)
  - User (with avatar)
  - Action (color-coded badge)
  - Resource type + ID (link to resource)
  - Status (success/failure icon)
  - Details (expandable)
- [ ] Real-time updates (optional WebSocket)

**15.2.3.2 Advanced Filters** (2-3h)
- [ ] Filter panel:
  - Date range picker (last 24h, 7d, 30d, custom)
  - User selector (autocomplete)
  - Action type multi-select
  - Resource type filter
  - Status filter (success/failure)
- [ ] Search bar (full-text search)
- [ ] Filter persistence (URL query params)

**15.2.3.3 Log Detail Modal** (2h)
- [ ] Expandable row or modal for details
- [ ] Display:
  - Full request/response (if available)
  - IP address and user agent
  - Session information
  - Related logs (same resource_id)
- [ ] Actions:
  - Copy log ID
  - Copy details as JSON
  - View related logs

---

## Phase 15.3: System Statistics Dashboard (22-28h)

**Goal**: 시스템 전체 통계 및 사용 패턴 분석

### 15.3.1 Backend Statistics API (10-12h)

**15.3.1.1 User Statistics** (3-4h)
- [ ] `GET /api/v1/admin/stats/users`
  - Total registered users
  - Active users (last 7d, 30d)
  - New users (daily/weekly trend)
  - User growth chart data
- [ ] `GET /api/v1/admin/stats/sessions`
  - Total sessions
  - Average session duration
  - Peak usage hours (heatmap data)
  - User activity timeline

**15.3.1.2 Dataset & Annotation Statistics** (3-4h)
- [ ] `GET /api/v1/admin/stats/datasets`
  - Total datasets
  - Total images
  - Total storage used (by dataset)
  - Recent uploads (last 7d, 30d)
  - Growth trends (images/annotations over time)
- [ ] `GET /api/v1/admin/stats/annotations`
  - Total annotations by task type
  - Annotations per day (trend)
  - Average labeling time per task type
  - Top annotators (leaderboard)

**15.3.1.3 System Performance Metrics** (2-3h)
- [ ] `GET /api/v1/admin/stats/performance`
  - API response times (p50, p95, p99)
  - Database query performance
  - Storage usage (R2/S3)
  - Error rates (by endpoint)
- [ ] Cache statistics:
  - User cache hit rate
  - Presigned URL cache performance

**15.3.1.4 Statistics Caching Service** (2h)
- [ ] Create `backend/app/services/stats_cache_service.py`
- [ ] Pre-calculate expensive statistics:
  - Run background jobs (Celery/APScheduler)
  - Cache in `system_stats_cache` table
  - TTL: 5-15 minutes depending on metric
- [ ] Incremental updates for real-time stats

### 15.3.2 Frontend Statistics Dashboard (12-16h)

**15.3.2.1 Overview Dashboard** (5-6h)
- [ ] Create `frontend/app/admin/stats/page.tsx`
- [ ] KPI Cards (top row):
  - Total users (with % change)
  - Active users (last 30d)
  - Total datasets
  - Total annotations
- [ ] Key charts:
  - User growth (line chart)
  - Annotation activity (bar chart)
  - Storage usage (pie chart)
  - Active hours heatmap

**15.3.2.2 User Analytics Tab** (3-4h)
- [ ] User statistics panel:
  - Registration trend (last 90 days)
  - Active vs inactive users
  - Session duration distribution
- [ ] User activity table:
  - Top users by annotation count
  - Top users by session time
  - Recent logins
- [ ] User engagement metrics:
  - Daily active users (DAU)
  - Weekly active users (WAU)
  - DAU/WAU ratio

**15.3.2.3 Dataset & Annotation Analytics Tab** (2-3h)
- [ ] Dataset growth chart:
  - Images uploaded over time
  - Annotations created over time
  - Completion rate trends
- [ ] Task type breakdown:
  - Annotations by task type (pie chart)
  - Average time per task type (bar chart)
- [ ] Recent activity timeline:
  - Latest dataset uploads
  - Latest annotation versions published

**15.3.2.4 Performance Monitoring Tab** (2-3h)
- [ ] API performance charts:
  - Response time percentiles (p50, p95, p99)
  - Request volume (by endpoint)
  - Error rate trends
- [ ] System health indicators:
  - Database connection pool
  - Cache hit rates
  - Storage usage alerts

---

## Phase 15.4: Integration & Polish (10-12h)

### 15.4.1 Permission & Access Control (3-4h)

**Role-based Access**:
- [ ] Admin menu visibility:
  - Only show to users with `system_role == 'admin'`
  - Use existing `user.is_admin` property (already implemented!)
  - No ProjectPermission check needed for global admin features
- [ ] API authorization:
  - Add `require_admin` dependency
  - Return 403 for non-admin users
- [ ] Route guards:
  - Redirect non-admin users to homepage

**Implementation**:
```python
# backend/app/core/security.py
async def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    # Use existing is_admin property (checks system_role == 'admin')
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
```

**Note**: User 모델에 이미 `system_role` 필드와 `is_admin` property가 구현되어 있음. UserDB 수정 불필요!

### 15.4.2 UI/UX Polish (4-5h)

**15.4.2.1 Sidebar Menu Updates** (2h)
- [ ] Add admin section to sidebar:
  ```tsx
  {user?.is_admin && (
    <>
      <div className="px-3 py-2 text-xs font-semibold text-gray-500">
        ADMIN
      </div>
      <SidebarButton icon={ChartBarIcon} onClick={() => navigate('/admin/datasets')}>
        Dataset Manager
      </SidebarButton>
      <SidebarButton icon={DocumentTextIcon} onClick={() => navigate('/admin/audit-logs')}>
        System Logs
      </SidebarButton>
      <SidebarButton icon={ChartPieIcon} onClick={() => navigate('/admin/stats')}>
        System Stats
      </SidebarButton>
    </>
  )}
  ```

**15.4.2.2 Layout & Navigation** (2h)
- [ ] Admin layout component:
  - Breadcrumbs for navigation
  - Page title and description
  - Action buttons (export, refresh)
- [ ] Tab navigation for multi-section pages
- [ ] Responsive design (min-width: 1280px)

**15.4.2.3 Loading & Error States** (1h)
- [ ] Skeleton loaders for charts and tables
- [ ] Error boundaries for each dashboard section
- [ ] Empty states with helpful messages
- [ ] Retry mechanisms for failed requests

### 15.4.3 Testing & Documentation (3h)

**Testing** (2h):
- [ ] Unit tests for audit_service.py
- [ ] Integration tests for admin APIs
- [ ] E2E tests for admin dashboard navigation
- [ ] Performance testing for statistics queries

**Documentation** (1h):
- [ ] Update API documentation (Swagger)
- [ ] Add admin guide: `docs/admin-dashboard-guide.md`
- [ ] Update RBAC documentation
- [ ] Add troubleshooting section

---

## Implementation Timeline

### Week 1 (20-25h)
- Day 1-2: Phase 15.1 Backend API (8-10h)
- Day 3-4: Phase 15.1 Frontend Dashboard (10-12h)
- Day 5: Phase 15.2 Library selection + Audit service (6h)

### Week 2 (20-25h)
- Day 1-2: Phase 15.2 Backend implementation (10-12h)
- Day 3-4: Phase 15.2 Frontend audit viewer (8-10h)
- Day 5: Phase 15.3 Statistics API (partial, 6h)

### Week 3 (20-25h)
- Day 1-2: Phase 15.3 Statistics API completion (6h) + Frontend stats dashboard (12-16h)
- Day 3-4: Phase 15.4 Integration & polish (10-12h)
- Day 5: Testing, documentation, buffer

**Total**: 60-75h over 2-3 weeks

---

## Technical Decisions

### 1. Database Choice for Audit Logs

**Constraint**: UserDB는 플랫폼팀 소유로 Labeler에서 수정 불가

**Options**:
- **Option A**: ~~User DB (PostgreSQL)~~ ❌ **불가능** (플랫폼팀 소유)
  - Cons: 권한 없음, 팀간 합의 필요

- **Option B**: Labeler DB (PostgreSQL) ✅ **선택됨**
  - Pros: 기존 DB 활용, 관리 간편, 빠른 구현
  - Pros: Labeler 관련 audit만 저장 (명확한 범위)
  - Cons: Cross-DB 쿼리 필요 (user 정보 조인 시)
  - Cons: DB 크기 증가 (partition으로 해결)

- **Option C**: Separate Audit DB (PostgreSQL)
  - Pros: 완전한 분리, 확장성 좋음
  - Cons: 추가 DB 관리, 설정 복잡도 증가

**Decision**: **Option B (Labeler DB)** - 빠른 구현, 기존 인프라 활용, 나중에 필요시 분리 가능

### 2. Audit Log Retention Policy

**Strategy**:
- Hot storage: Last 90 days (PostgreSQL)
- Warm storage: 90 days - 1 year (compressed, archived)
- Cold storage: 1+ years (S3/R2, compressed JSON)

**Implementation**:
- Background job to archive old logs monthly
- Compressed JSON export to R2
- Delete from PostgreSQL after archival

### 3. Real-time vs Batch Statistics

**Approach**: **Hybrid**
- Real-time: Simple counts (total users, datasets)
- Cached (5-15min): Expensive aggregations (trends, charts)
- Batch (daily): Historical data, complex analytics

**Caching Strategy**:
- Redis for frequently accessed stats (TTL: 5-15min)
- DB cache table for pre-calculated metrics
- Background jobs for daily/weekly aggregations

### 4. Audit Middleware Performance

**Concerns**:
- Logging on every request adds latency
- Async logging to avoid blocking

**Solution**:
```python
async def audit_middleware(request: Request, call_next):
    # Log request (async, non-blocking)
    asyncio.create_task(log_request(request))

    # Process request
    response = await call_next(request)

    # Log response (async, non-blocking)
    asyncio.create_task(log_response(request, response))

    return response
```

---

## Dependencies

**Phase Dependencies**:
- ✅ Phase 8.1 (RBAC) - Required for admin role checking
- ✅ Phase 9.1 (User DB) - Required for audit log storage
- ⏸️ Phase 8.6 (Activity Log) - Related but separate feature

**External Libraries**:
- Audit logging: Custom implementation (FastAPI middleware + SQLAlchemy events)
- Charts: Recharts (frontend)
- Date handling: date-fns (frontend)
- CSV export: csv-writer (backend)

---

## Success Metrics

**Adoption Metrics**:
- 80%+ of admins use dashboard weekly
- Average session duration > 5 minutes
- 90%+ admin satisfaction rating

**Performance Metrics**:
- Audit log write latency < 10ms (async)
- Dashboard load time < 2 seconds
- Statistics cache hit rate > 90%

**Coverage Metrics**:
- 100% of critical actions logged
- 95%+ uptime for admin dashboard
- Zero data loss in audit logs

---

## Future Enhancements (Post-Phase 15)

**Advanced Analytics**:
- Predictive analytics (annotation completion forecasts)
- Anomaly detection (unusual user activity)
- Cost analysis (storage, compute)

**Alerting & Monitoring**:
- Real-time alerts (Slack, email)
- Threshold-based notifications (storage > 90%, errors > 1%)
- Custom dashboards (Grafana integration)

**Compliance & Security**:
- GDPR compliance (data export, deletion)
- SOC 2 audit trail
- Security incident response workflows

---

## Files to Create

**Backend**:
- `backend/app/services/audit_service.py` (Audit logging service)
- `backend/app/services/stats_cache_service.py` (Statistics caching)
- `backend/app/middleware/audit_middleware.py` (Request logging middleware)
- `backend/app/api/v1/endpoints/admin_datasets.py` (Dataset management API)
- `backend/app/api/v1/endpoints/admin_audit.py` (Audit log API)
- `backend/app/api/v1/endpoints/admin_stats.py` (Statistics API)
- `backend/app/db/models/audit.py` (Audit log models)
- `backend/alembic/versions/YYYYMMDD_HHMM_add_audit_tables.py` (Migration)

**Frontend**:
- `frontend/app/admin/layout.tsx` (Admin layout wrapper)
- `frontend/app/admin/datasets/page.tsx` (Dataset manager)
- `frontend/app/admin/audit-logs/page.tsx` (Audit log viewer)
- `frontend/app/admin/stats/page.tsx` (Statistics dashboard)
- `frontend/components/admin/DatasetOverviewCard.tsx` (Dataset KPI card)
- `frontend/components/admin/AuditLogTable.tsx` (Log table component)
- `frontend/components/admin/StatisticsChart.tsx` (Reusable chart component)
- `frontend/lib/api/admin.ts` (Admin API client)

**Documentation**:
- `docs/admin-dashboard-guide.md` (Admin user guide)
- `docs/audit-log-specification.md` (Audit log format spec)

---

## Open Questions

1. **Admin Role Definition**: ✅ RESOLVED
   - User 모델에 이미 `system_role` 필드 존재 ('admin' or 'user')
   - `is_admin` property도 이미 구현됨
   - **Decision**: 기존 필드 활용, UserDB 수정 불필요

2. **Audit Log Scope**:
   - Should we log read operations (GET requests)?
   - **Recommendation**: No, only log mutations (POST, PUT, DELETE) and auth events

3. **Statistics Refresh Rate**:
   - How often should statistics be recalculated?
   - **Recommendation**: 5-15min cache, manual refresh button

4. **Multi-tenancy Considerations**:
   - Should audit logs be per-organization or global?
   - **Recommendation**: Global for now, add organization_id filter later

5. **Audit Log DB Location**: ✅ RESOLVED
   - Cannot use UserDB (플랫폼팀 소유)
   - **Decision**: Labeler DB 활용
   - Rationale: 기존 인프라, 빠른 구현, 나중에 분리 가능

---

## Implementation Constraints (2025-11-26 Update)

**UserDB Restrictions**:
- ❌ Cannot modify UserDB schema (플랫폼팀 소유)
- ❌ Cannot add tables to UserDB
- ✅ Can READ from UserDB (User, Organization tables)
- ✅ User.system_role already exists ('admin' or 'user')
- ✅ User.is_admin property already implemented

**Revised Architecture**:
```
User DB (Platform - Read Only)
  ├── users (READ ONLY - has system_role field)
  └── organizations (READ ONLY)

Labeler DB (Full Access)
  ├── annotations, projects (existing)
  ├── audit_logs (NEW - all audit trail)
  ├── user_sessions (NEW - session tracking)
  └── system_stats_cache (NEW - statistics cache)
```

**Cross-DB Query Pattern**:
```python
# Get audit log with user info
audit_log = labeler_db.query(AuditLog).filter(...).first()
user = user_db.query(User).filter(User.id == audit_log.user_id).first()

# Combine results
result = {
    "audit_log": audit_log,
    "user": user.email,
    "is_admin": user.is_admin
}
```

---

**Last Updated**: 2025-11-26 (Revised with UserDB constraints)
**Author**: Claude Code + Development Team
