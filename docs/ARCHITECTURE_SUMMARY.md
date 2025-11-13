# Architecture Summary - Vision AI Labeler

**Date**: 2025-01-13 (Final)
**Status**: Ready for Implementation
**Version**: 2.0

## 🎯 Key Architectural Decisions

### 1. Database Strategy: **Separate DBs + Read Replica** ✅

**Previous**: Shared database with table prefixes
**Updated**: Complete database separation with read replica for Platform data

```
Platform DB (Master)
       ↓ (replication)
Platform DB Replica ←── Labeler Backend reads users/datasets (read-only)
                                ↓
                         Labeler DB ←── Labeler Backend writes annotations (full control)
```

**Why Changed?**
- ✅ Complete independence (failures isolated)
- ✅ Performance isolation (no query contention)
- ✅ Security (Labeler can't modify Platform data)
- ✅ Independent scaling & migrations

**Trade-off**: Small replication lag (< 1s) - acceptable for UI

**See**: [Database Separation Strategy](./design/DATABASE_SEPARATION_STRATEGY.md)

---

### 2. Service Architecture: **Microservices** ✅

```
┌──────────────┐         ┌──────────────┐
│  Platform    │         │  Labeler     │
│  Backend     │         │  Backend     │
│  :8000       │         │  :8001       │
└──────┬───────┘         └──────┬───────┘
       │                        │
       └────────┬───────────────┘
                │ Shared Resources
                ▼
    ┌───────────────────────┐
    │ PostgreSQL (2 DBs)    │
    │ MinIO/R2 (shared)     │
    │ Redis (shared)        │
    │ JWT Secret (shared)   │
    └───────────────────────┘
```

**Benefits**:
- Independent deployment
- Isolated failures
- Technology flexibility

---

### 3. Phase 1 Scope: **5 Core Tasks** ✅

**Included in Phase 1 (Weeks 1-5)**:
1. ✅ Classification (single, multi, group, hierarchical)
2. ✅ Object Detection (horizontal bbox + rotated bbox OBB)
3. ✅ Segmentation (polygon + brush)
4. ✅ Line Detection (straight, polyline, circle/arc)
5. ✅ Open Vocabulary (standalone + integrated)

**Deferred**:
- OCR → Phase 3 (with AI assistance)
- Pose Estimation → Phase 4

---

### 4. Technology Stack: **Confirmed** ✅

**Frontend**:
- Next.js 14 (App Router) + TypeScript
- **Fabric.js** (canvas library - confirmed!)
- Zustand (state management)
- TailwindCSS + shadcn/ui

**Backend**:
- FastAPI + SQLAlchemy
- PostgreSQL 16 (x2: Platform replica + Labeler)
- Redis 7 (cache + pub/sub)
- MinIO/R2 (storage)

---

### 5. AI Features: **Essential** ✅

**Not optional - core competitive advantage**:
- Smart validation algorithms (all phases)
- SAM integration (Phase 3)
- Auto-labeling suggestions
- Auto-fix common issues:
  * Self-intersecting polygons
  * Duplicate vertices
  * Snap to pixel grid
  * Normalize angles

---

### 6. Import/Export: **Flexible Architecture** ✅

**Import**:
- Generic converter interface
- Add format-specific converters as needed
- Priority: COCO, YOLO, CVAT XML

**Export** (Phase 1):
- COCO format
- YOLO format
- Custom JSON

---

### 7. Collaboration: **Async + Communication** ✅

**Included**:
- Task assignment & review workflows (Phase 4)
- Comment threads on images/annotations
- Activity indicators (who's working on what)

**Not included**:
- Real-time concurrent editing (too complex for MVP)
- Google Docs-style live collaboration (future)

---

### 8. Mobile Support: **Not Required** ✅

- Focus on desktop/laptop (1280px+ screen)
- Tablet support deferred to post-MVP
- Mobile annotation not planned

---

## 📊 Data Flow

### User Creates Project
```
1. User logs in → Platform (JWT token)
2. User opens Labeler → Same JWT token validated
3. User creates project:
   - Labeler reads users, datasets (Platform DB replica)
   - Labeler writes project (Labeler DB)
4. User starts annotating:
   - Images loaded from S3 (presigned URLs)
   - Annotations saved to Labeler DB
   - Auto-sync to S3 annotations.json (background)
```

### Training Workflow Integration
```
1. Labeler: User completes annotations
2. Labeler: Export snapshot → S3
3. Platform: Training job references snapshot
4. Platform: Reads annotations from S3
5. Platform: Trains model with snapshot data
```

---

## 🗄️ Database Layout

### Platform DB (Master)
```sql
-- Platform owns (writes)
users (id, email, password_hash, ...)
datasets (id, name, owner_id, storage_path, ...)
training_jobs (id, dataset_id, model_name, ...)
snapshots (id, dataset_id, snapshot_type, ...)
```

### Platform DB Replica (Read-Only)
```sql
-- Labeler reads from here
users (replicated)
datasets (replicated)
snapshots (replicated)
```

### Labeler DB (Independent)
```sql
-- Labeler owns (full control)
annotation_projects (id, dataset_id, task_types, classes, ...)
annotations (id, project_id, image_id, geometry, class_id, ...)
annotation_tasks (id, project_id, assignee_id, ...)
comments (id, project_id, image_id, text, ...)
annotation_history (id, annotation_id, action, previous_state, ...)
```

**No foreign keys across databases** - referential integrity in application layer

---

## 🔐 Security Model

### Authentication
```
1. User logs in to Platform
2. Platform generates JWT token (signed with JWT_SECRET)
3. Labeler validates token using same JWT_SECRET
4. No separate login required
```

### Authorization
```python
# Labeler checks permissions
if user.id != project.owner_id and user not in project.members:
    raise HTTP_403_Forbidden
```

### Storage Access
```python
# Generate presigned URLs (1 hour expiry)
url = s3_client.generate_presigned_url(
    'get_object',
    Params={'Bucket': bucket, 'Key': image_path},
    ExpiresIn=3600
)
```

---

## 📈 Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| Image load | < 500ms | Progressive loading (thumbnail → full) |
| Canvas FPS | 60 FPS | Viewport culling, throttled rendering |
| Annotation save | < 200ms | Optimistic UI + background sync |
| DB query (Platform) | < 50ms | Read replica, Redis cache (5 min) |
| DB query (Labeler) | < 20ms | Direct connection, indexed queries |
| Export (1000 images) | < 10s | Background job (Celery) |

---

## 🚀 Implementation Phases

### Phase 1: Core Annotation (Weeks 1-5)
- Classification, Detection, Segmentation, Lines, Open Vocab
- Undo/Redo, Auto-save, Export (COCO)

### Phase 2: Advanced Features (Weeks 6-10)
- Rotated bbox optimization
- Advanced segmentation (brush, SAM preview)
- Import converters (COCO, YOLO)

### Phase 3: AI Assistance (Weeks 11-15)
- SAM integration
- OCR tool
- Auto-labeling suggestions
- Smart validation

### Phase 4: Collaboration (Weeks 16-20)
- Task assignment
- Review workflow
- Comments & communication
- Pose estimation

### Phase 5: Production Polish (Weeks 21-24)
- Performance optimization
- Mobile/tablet support
- Documentation
- Deployment automation

---

## 📝 Development Workflow

### Week 1: Setup
```bash
# Setup databases
docker-compose up -d postgres-platform postgres-labeler

# Setup Platform DB replica (for production)
# Development: Use read-only user instead

# Initialize projects
npx create-next-app labeler-frontend
poetry new labeler-backend

# Run migrations
cd labeler/backend
alembic upgrade head
```

### Weeks 2-5: Core Features
```bash
# Test-driven development
pytest tests/unit/
pytest tests/integration/

# Deploy to staging
docker-compose -f docker-compose.staging.yml up -d
```

---

## 🔄 Rollback Plan

If separate DB causes issues:

**Fallback Option**: Read-only user on Platform DB
```sql
-- Instead of replica, use read-only user
CREATE USER labeler_readonly WITH PASSWORD 'pass';
GRANT SELECT ON users, datasets, snapshots TO labeler_readonly;

-- Labeler uses this user
PLATFORM_DB_URL = postgresql://labeler_readonly:pass@platform-db:5432/platform
```

This gives similar isolation without replication infrastructure.

---

## 📚 Documentation

### Design Documents
1. [PROJECT_DESIGN.md](./design/PROJECT_DESIGN.md) - Overall project design
2. [PLATFORM_INTEGRATION.md](./design/PLATFORM_INTEGRATION.md) - Integration strategy
3. [DATABASE_SEPARATION_STRATEGY.md](./design/DATABASE_SEPARATION_STRATEGY.md) - DB options comparison ⭐
4. [DATABASE_SCHEMA.md](./design/DATABASE_SCHEMA.md) - Labeler DB schema
5. [API_SPEC.md](./design/API_SPEC.md) - REST API specification
6. [IMPLEMENTATION_GUIDE.md](./design/IMPLEMENTATION_GUIDE.md) - Phase 1 guide
7. [DESIGN_SYSTEM.md](./design/DESIGN_SYSTEM.md) - UI/UX design system 🎨

### Key Highlights
- ⭐ **NEW**: DB separation with read replica
- ⭐ **NEW**: 4-option comparison (FDW, Replica, API, Events)
- ⭐ **NEW**: Complete design system with Platform consistency
- ⭐ Fabric.js confirmed as canvas library
- ⭐ Smart validation algorithms detailed
- ⭐ Import converter architecture

---

## ✅ Ready for Implementation

All design decisions finalized. Development can start immediately!

**Next Steps**:
1. Set up Docker Compose environment
2. Initialize Next.js + FastAPI projects
3. Configure dual database connections
4. Implement first annotation tool (rectangle)
5. Test end-to-end workflow

---

**Last Updated**: 2025-01-13
**Status**: Final Architecture - Approved
