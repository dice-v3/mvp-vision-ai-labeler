# Vision AI Labeler

Web-based annotation tool for Vision AI Training Platform.

## 📋 Project Status

**Status**: Phase 16 Complete ✅ (Platform Integration)
**Version**: 1.16.6
**Current Phase**: Phase 16.6 - Task-Type-Specific Dataset Query

### Completed Phases
- ✅ Phase 1-8: Core Annotation System
- ✅ Phase 9: Database Separation & User Management
- ✅ Phase 10: Version Management & Rollback
- ✅ Phase 11: Version Diff & Comparison
- ✅ Phase 12: Annotation Locking System
- ✅ Phase 13: Project Permission System (RBAC)
- ✅ Phase 14: Team Collaboration (Invitations)
- ✅ Phase 15: Admin Dashboard & Audit System
- ✅ Phase 16: Platform Integration (Service-to-Service JWT)

---

## 🎯 Overview

Vision AI Labeler is a production-ready web annotation tool supporting:
- **Classification**: Single, multi-label, hierarchical classes
- **Object Detection**: Horizontal + Rotated bounding boxes (OBB)
- **Segmentation**: Polygon drawing + brush tool
- **Line Detection**: Straight lines, polylines, circles/arcs
- **Open Vocabulary**: Image-level + per-annotation captions

**Key Features**:
- 🎨 Multi-task support in single project
- 🤖 AI-assisted annotation (SAM, smart validation)
- 👥 Collaborative workflows (task assignment, review)
- 📤 Flexible import/export (COCO, YOLO, DICE)
- ⚡ 60 FPS canvas rendering (Fabric.js)
- 💾 Auto-save with undo/redo
- 🔒 Annotation locking (prevent conflicts)
- 🔐 RBAC with 5 roles (owner, admin, reviewer, annotator, viewer)
- 📊 Version management with diff/comparison
- 🔄 Platform integration with Hybrid JWT

---

## 🏗️ Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                      User Browser                            │
│  ┌────────────────┐              ┌──────────────────┐       │
│  │ Platform UI    │              │  Labeler UI      │       │
│  │ (Training)     │              │  (Annotation)    │       │
│  └────────┬───────┘              └────────┬─────────┘       │
└───────────┼──────────────────────────────┼─────────────────┘
            │                              │
            │ User JWT (Platform)          │ User JWT (Labeler)
            ▼                              ▼
┌───────────────────────┐      ┌───────────────────────┐
│  Platform Backend     │◄─────┤  Labeler Backend      │
│  :8000                │      │  :8001                │
│                       │      │                       │
│  User DB (Master)     │      │  User DB (Read-Only)  │
│  Platform DB          │      │  Platform DB (R/O)    │
│                       │      │  Labeler DB (R/W)     │
└───────────────────────┘      └───────────────────────┘
            │                Service JWT                │
            │◄───────────────────────────────────────►│
            │         (Phase 16: Service-to-Service)   │
            │                                          │
            └──────────┬───────────────────────────────┘
                       │ Shared Resources
                       ▼
            ┌──────────────────────┐
            │  Cloudflare R2       │
            │  Redis (Cache)       │
            │  JWT Secrets (Auth)  │
            └──────────────────────┘
```

### Database Architecture

**⚠️ Architecture Update (2025-12-09)**: Consolidated to single PostgreSQL instance

**Single Instance, Three Databases**:

```
PostgreSQL Instance (port 5432)  ← Platform team manages
├── platform database            ← Platform owns (Labeler: read-only)
├── users database               ← Platform owns (Labeler: read-only)
└── labeler database             ← Labeler owns (schema only)
    ├─→ Projects, Annotations
    ├─→ Versions, Locks
    ├─→ Permissions, Invitations
    └─→ Audit Logs
```

**Benefits**:
- ✅ Resource efficiency (1 PostgreSQL process vs 3)
- ✅ Simplified port management (single port 5432)
- ✅ Standard PostgreSQL practice
- ✅ Logical isolation (databases cannot query each other)
- ✅ Complete independence for Labeler operations
- ✅ Security (read-only access to Platform data)

**Migration**: If upgrading from old architecture (3 separate containers), see [DATABASE_MIGRATION_GUIDE.md](./docs/DATABASE_MIGRATION_GUIDE.md)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **PostgreSQL** 14+
- **Docker** (for PostgreSQL containers)
- **Redis** 7+

### 1. Clone Repository

```bash
git clone https://github.com/your-org/mvp-vision-ai-labeler.git
cd mvp-vision-ai-labeler
```

### 2. Setup Backend

```bash
cd backend

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# IMPORTANT: Update database passwords, JWT secrets, R2 credentials

# Install Python dependencies
pip install -r requirements.txt

# Run database initialization script
python scripts/init_database.py

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### 3. Setup Frontend

```bash
cd frontend

# Copy environment template
cp .env.example .env.local

# Edit .env.local
# Update NEXT_PUBLIC_API_URL to http://localhost:8001

# Install dependencies
npm install

# Start frontend server
npm run dev
```

### 4. Access Application

- **Frontend**: http://localhost:3010
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs

---

## 📚 Documentation

### 🚀 Start Here
- [ARCHITECTURE_SUMMARY.md](./docs/ARCHITECTURE_SUMMARY.md) - **Read this first!** Complete overview
- [ANNOTATION_IMPLEMENTATION_TODO.md](./docs/ANNOTATION_IMPLEMENTATION_TODO.md) - Implementation progress tracker

### 📖 Integration Guides
- [PLATFORM_ANNOTATION_FORMAT.md](./docs/integration/PLATFORM_ANNOTATION_FORMAT.md) - Annotation file format for Platform integration
- [Phase 16 Documentation](./docs/integration/) - Platform integration details

### 🚀 Deployment & Operations
- [DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) - Production deployment guide
- [DATABASE_MIGRATION_GUIDE.md](./docs/DATABASE_MIGRATION_GUIDE.md) - **NEW!** Migrate to single PostgreSQL instance

### 🎨 Design Documents
1. [PROJECT_DESIGN.md](./docs/design/PROJECT_DESIGN.md) - Overall project design & features
2. [PLATFORM_INTEGRATION.md](./docs/design/PLATFORM_INTEGRATION.md) - How Labeler integrates with Platform
3. [DATABASE_SEPARATION_STRATEGY.md](./docs/design/DATABASE_SEPARATION_STRATEGY.md) - DB architecture
4. [DATABASE_SCHEMA.md](./docs/design/DATABASE_SCHEMA.md) - Labeler database schema
5. [API_SPEC.md](./docs/design/API_SPEC.md) - REST API + WebSocket specification

### 🔧 Implementation
- [Phase Documentation](./docs/) - Detailed phase-by-phase implementation notes

---

## 🗄️ Database Setup

**⚠️ IMPORTANT**: Database architecture changed on 2025-12-09. Use Platform's infrastructure!

### Option 1: Using Platform Infrastructure (Recommended)

```bash
# Step 1: Start Platform's PostgreSQL instance
cd ../mvp-vision-ai-platform/infrastructure
docker-compose up -d

# This creates PostgreSQL 16 on port 5432 with 3 databases:
# - platform (Platform team)
# - users (Platform team, shared)
# - labeler (empty, ready for Labeler schema)

# Step 2: Initialize Labeler schema
cd ../../mvp-vision-ai-labeler/backend
python scripts/init_database.py

# This will:
# 1. Connect to labeler database (port 5432)
# 2. Run all Alembic migrations
# 3. Verify all tables exist
```

### Option 2: Manual Setup (Production)

```bash
# Platform team provides:
# 1. PostgreSQL instance endpoint (RDS, Cloud SQL, etc.)
# 2. Database 'labeler' already created
# 3. Connection credentials

# Update .env with production credentials
# All databases should use port 5432

cd backend

# Run Labeler schema migrations
alembic upgrade head

# Verify
alembic current
```

### Migration from Old Architecture

If you're upgrading from the old 3-container setup, see [DATABASE_MIGRATION_GUIDE.md](./docs/DATABASE_MIGRATION_GUIDE.md)

---

## 🔐 Authentication

### User Authentication (Browser)

Users log in through Platform and receive a JWT token:

```
User → Platform Login → JWT Token → Labeler
```

### Service Authentication (Phase 16)

Platform backend calls Labeler backend with Service JWT:

```python
# Platform generates Service JWT
token = jwt.encode({
    "sub": "1",  # user_id
    "service": "platform",
    "scopes": ["labeler:read", "labeler:write"],
    "type": "service"
}, SERVICE_JWT_SECRET)

# Call Labeler API
response = requests.get(
    "http://labeler:8001/api/v1/platform/datasets",
    headers={"Authorization": f"Bearer {token}"}
)
```

**CRITICAL**: `SERVICE_JWT_SECRET` must match between Platform and Labeler!

---

## 📤 Export Formats

### DICE Format (Recommended)

```json
{
  "format_version": "1.0",
  "dataset_id": "ds_abc123",
  "task_type": "object_detection",
  "storage_info": {
    "storage_type": "s3",
    "bucket": "training-datasets",
    "image_root": "datasets/ds_abc123/images/"
  },
  "classes": [...],
  "images": [...],
  "statistics": {...}
}
```

### COCO Format

Standard COCO format with additional `storage_info` section for Platform integration.

### YOLO Format

YOLOv8 compatible format with `data.yaml` configuration.

---

## 🔄 Platform Integration (Phase 16)

### Dataset Query API

Platform can query datasets filtered by task_type:

```python
# Get detection datasets only
GET /api/v1/platform/datasets?task_type=detection&labeled=true

# Response includes task-specific statistics
{
  "datasets": [{
    "id": "ds_abc123",
    "name": "mvtec-ad",
    "num_images": 163,  // detection task images
    "published_task_types": ["detection"],
    "annotation_path": "exports/.../detection/v10.0/annotations.json"
  }]
}
```

### Key Features:
- **Task-Type Filtering**: Query datasets by detection/segmentation/classification
- **Task-Specific Statistics**: Get accurate image counts per task type
- **Storage Information**: Annotation files include S3/R2 paths for image downloads
- **Multiple Task Types**: One dataset can be published for multiple tasks

---

## 🛠️ Technology Stack

### Backend
- **FastAPI** - Modern async web framework
- **SQLAlchemy** - ORM with Alembic migrations
- **PostgreSQL** - Primary database (3 separate instances)
- **Redis** - Caching and real-time features
- **Cloudflare R2** - Object storage (S3-compatible)
- **Pydantic** - Data validation

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Fabric.js** - Canvas rendering engine
- **Zustand** - State management
- **TailwindCSS** - Styling
- **Radix UI** - Accessible components

---

## 📊 Project Structure

```
mvp-vision-ai-labeler/
├── backend/
│   ├── app/
│   │   ├── api/              # API endpoints
│   │   ├── core/             # Core functionality
│   │   ├── db/               # Database models
│   │   ├── schemas/          # Pydantic schemas
│   │   └── services/         # Business logic
│   ├── alembic/              # Database migrations
│   ├── scripts/              # Utility scripts
│   └── tests/                # Tests
├── frontend/
│   ├── app/                  # Next.js app router
│   ├── components/           # React components
│   ├── lib/                  # Utilities & stores
│   └── public/               # Static assets
└── docs/                     # Documentation
    ├── design/               # Design documents
    ├── integration/          # Integration guides
    └── *.md                  # Phase documentation
```

---

## 🧪 Testing

### Backend Tests

```bash
cd backend
pytest tests/
```

### Frontend Tests

```bash
cd frontend
npm test
```

---

## 🚢 Deployment

### Backend Deployment

```bash
# Production environment
ENVIRONMENT=production
DEBUG=false

# Use production secrets
SERVICE_JWT_SECRET=<production-secret>
JWT_SECRET_KEY=<production-secret>

# Production databases
LABELER_DB_HOST=<production-db-host>
# ... update all DB credentials

# Start with gunicorn
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8001
```

### Frontend Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

---

## 📝 Environment Variables

### Critical Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SERVICE_JWT_SECRET` | Service-to-service auth (MUST match Platform!) | ✅ Yes |
| `JWT_SECRET_KEY` | User authentication secret | ✅ Yes |
| `LABELER_DB_*` | Labeler database connection | ✅ Yes |
| `USER_DB_*` | User database connection (read-only) | ✅ Yes |
| `PLATFORM_DB_*` | Platform database connection (read-only) | ✅ Yes |
| `S3_ENDPOINT` | Cloudflare R2 endpoint | ✅ Yes |
| `S3_ACCESS_KEY` | R2 access key | ✅ Yes |
| `S3_SECRET_KEY` | R2 secret key | ✅ Yes |

See [.env.example](./backend/.env.example) for complete list.

---

## 🤝 Contributing

1. Create feature branch from `develop`
2. Follow existing code style
3. Write tests for new features
4. Update documentation
5. Submit pull request

---

## 📄 License

[Your License Here]

---

## 🆘 Support

**Issues**: GitHub Issues
**Docs**: [./docs/](./docs/)
**Slack**: #labeler-backend

---

**Last Updated**: 2025-11-30
**Version**: 1.16.6
**Phase**: 16.6 (Task-Type-Specific Dataset Query)
