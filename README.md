# Vision AI Labeler

Web-based annotation tool for Vision AI Training Platform.

## 📋 Project Status

**Status**: Design Phase Complete ✅
**Version**: 0.2 (Ready for Implementation)
**Phase**: Phase 1 (Core Annotation) - Weeks 1-5

---

## 🎯 Overview

Vision AI Labeler is a production-ready web annotation tool supporting:
- **Classification**: Single, multi-label, group labeling, hierarchical classes
- **Object Detection**: Horizontal + Rotated bounding boxes (OBB)
- **Segmentation**: Polygon drawing + brush tool
- **Line Detection**: Straight lines, polylines, circles/arcs
- **Open Vocabulary**: Image-level + per-annotation captions
- **OCR**: Text detection + recognition (Phase 3)
- **Pose Estimation**: Keypoint annotation (Phase 4)

**Key Features**:
- 🎨 Multi-task support in single project
- 🤖 AI-assisted annotation (SAM, smart validation)
- 👥 Collaborative workflows (task assignment, review)
- 📤 Flexible import/export (COCO, YOLO, custom)
- ⚡ 60 FPS canvas rendering (Fabric.js)
- 💾 Auto-save with undo/redo

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
            │ JWT Token                    │ Same JWT
            ▼                              ▼
┌───────────────────────┐      ┌───────────────────────┐
│  Platform Backend     │      │  Labeler Backend      │
│  :8000                │      │  :8001                │
│                       │      │                       │
│  Platform DB ◄────────┼──────┤  Platform DB Replica  │ (read users/datasets)
│  (Master)             │      │  (Read-Only)          │
│                       │      │                       │
│                       │      │  Labeler DB           │ (full control)
│                       │      │  (Independent)        │
└───────────────────────┘      └───────────────────────┘
            │                              │
            └──────────┬───────────────────┘
                       │ Shared Resources
                       ▼
            ┌──────────────────────┐
            │  MinIO/R2 (Storage)  │
            │  Redis (Cache)       │
            │  JWT Secret (Auth)   │
            └──────────────────────┘
```

### Database Strategy

**Separate DBs + Read Replica** (Updated Architecture)

```
Platform DB Master → Platform DB Replica → Labeler reads
                                              ↓
                                        Labeler DB ← Labeler writes
```

**Why?**
- ✅ Complete independence
- ✅ Performance isolation
- ✅ Independent scaling
- ✅ Security (read-only access to Platform data)

**See**: [Database Separation Strategy](./docs/design/DATABASE_SEPARATION_STRATEGY.md)

---

## 📚 Documentation

### 🚀 Start Here
- [ARCHITECTURE_SUMMARY.md](./docs/ARCHITECTURE_SUMMARY.md) - **Read this first!** Complete overview

### 🎨 Design Documents
1. [PROJECT_DESIGN.md](./docs/design/PROJECT_DESIGN.md) - Overall project design & features
2. [PLATFORM_INTEGRATION.md](./docs/design/PLATFORM_INTEGRATION.md) - How Labeler integrates with Platform
3. [DATABASE_SEPARATION_STRATEGY.md](./docs/design/DATABASE_SEPARATION_STRATEGY.md) ⭐ - DB architecture (4 options compared)
4. [DATABASE_SCHEMA.md](./docs/design/DATABASE_SCHEMA.md) - Labeler database schema
5. [API_SPEC.md](./docs/design/API_SPEC.md) - REST API + WebSocket specification
6. [IMPLEMENTATION_GUIDE.md](./docs/design/IMPLEMENTATION_GUIDE.md) - Phase 1 implementation guide
7. [DESIGN_SYSTEM.md](./docs/design/DESIGN_SYSTEM.md) 🎨 - UI/UX design system & component library

### 📊 Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Database** | Separate DBs + Read Replica | Independence, performance, security |
| **Canvas Library** | Fabric.js | Rich interactions, mature ecosystem |
| **Phase 1 Tasks** | Cls + Det + Seg + Line + OpenVocab | Core functionality first |
| **AI Features** | Essential | Competitive advantage |
| **Collaboration** | Async (no real-time editing) | Simpler for MVP |
| **Mobile** | Not required | Desktop focus |

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** (App Router) + TypeScript
- **Fabric.js** (Canvas rendering)
- **Zustand** (State management)
- **TanStack Query** (API client)
- **TailwindCSS + shadcn/ui** (Styling)

### Backend
- **FastAPI** (Python web framework)
- **SQLAlchemy 2.0** (ORM)
- **PostgreSQL 16** (Database x2)
- **Redis 7** (Cache + Pub/Sub)
- **MinIO/R2** (S3-compatible storage)

---

## 🗓️ Development Timeline

| Phase | Weeks | Deliverable |
|-------|-------|-------------|
| **Phase 1** | 1-5 | Core annotation (Cls, Det, Seg, Line, OpenVocab) |
| **Phase 2** | 6-10 | Advanced tools (OBB optimization, Import) |
| **Phase 3** | 11-15 | AI assistance (SAM, OCR, Auto-label) |
| **Phase 4** | 16-20 | Collaboration (Tasks, Review, Pose) |
| **Phase 5** | 21-24 | Production polish (Performance, Docs) |

**Total**: 24 weeks (~6 months)

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- PostgreSQL 16 (via Docker)

### Setup Development Environment

```bash
# 1. Clone repository
git clone https://github.com/yourorg/mvp-vision-ai-labeler.git
cd mvp-vision-ai-labeler

# 2. Start infrastructure
docker-compose up -d

# Services:
# - PostgreSQL (Platform DB Master): :5432
# - PostgreSQL (Labeler DB): :5433
# - Redis: :6379
# - MinIO: :9000 (API), :9001 (Console)

# 3. Setup backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start backend
uvicorn app.main:app --reload --port 8001

# 4. Setup frontend
cd ../frontend
npm install
npm run dev  # Starts on :3001

# Access:
# - Labeler UI: http://localhost:3001
# - Labeler API: http://localhost:8001
# - MinIO Console: http://localhost:9001 (user: minioadmin, pass: minioadmin)
```

---

## 📝 Project Structure

```
mvp-vision-ai-labeler/
├── docs/
│   ├── ARCHITECTURE_SUMMARY.md       ← Start here!
│   └── design/
│       ├── PROJECT_DESIGN.md
│       ├── PLATFORM_INTEGRATION.md
│       ├── DATABASE_SEPARATION_STRATEGY.md  ← Important!
│       ├── DATABASE_SCHEMA.md
│       ├── API_SPEC.md
│       ├── IMPLEMENTATION_GUIDE.md
│       └── DESIGN_SYSTEM.md          ← UI/UX design guide
│
├── frontend/                          # Next.js frontend
│   ├── app/                          # App Router
│   ├── components/                   # React components
│   ├── lib/                          # Core logic
│   │   ├── annotation-engine/       # Canvas & tools
│   │   ├── api/                     # API clients
│   │   └── stores/                  # Zustand stores
│   └── package.json
│
├── backend/                           # FastAPI backend
│   ├── app/
│   │   ├── api/v1/                  # REST endpoints
│   │   ├── core/                    # Config, security
│   │   ├── db/                      # Models, session
│   │   ├── services/                # Business logic
│   │   └── main.py
│   ├── alembic/                     # DB migrations
│   └── requirements.txt
│
├── docker-compose.yml                 # Development environment
└── README.md                          # This file
```

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/unit/
pytest tests/integration/
pytest --cov=app tests/  # With coverage
```

### Frontend Tests
```bash
cd frontend
npm test                 # Unit tests (Vitest)
npm run test:e2e        # E2E tests (Playwright)
```

---

## 📦 Deployment

### Development
```bash
docker-compose up -d
```

### Production (Kubernetes)
```bash
# Build images
docker build -t labeler-backend:latest ./backend
docker build -t labeler-frontend:latest ./frontend

# Deploy to Kubernetes
kubectl apply -f k8s/labeler-backend.yaml
kubectl apply -f k8s/labeler-frontend.yaml

# Or use Helm
helm install labeler ./helm-charts/labeler
```

---

## 🤝 Integration with Platform

### Shared Resources
- **Authentication**: Same JWT secret, tokens work across both services
- **Storage**: MinIO/R2 buckets shared (different paths)
- **Database**: Platform DB replica (read-only) + Labeler DB (independent)

### Data Flow
1. User creates dataset in **Platform** → Stored in S3
2. User opens **Labeler** → Creates annotation project
3. User annotates images → Saved to Labeler DB + S3
4. User exports snapshot → Available for training in **Platform**
5. **Platform** trains model using snapshot

---

## 🔒 Security

- **JWT Authentication**: Shared secret with Platform
- **Read-Only Access**: Labeler can only read Platform data (via replica)
- **Presigned URLs**: S3 access with 1-hour expiry
- **Role-Based Access**: User permissions enforced

---

## 🐛 Known Limitations (MVP)

- ❌ No real-time collaboration (async only)
- ❌ No mobile support (desktop 1280px+ only)
- ❌ No video annotation (images only)
- ❌ Replication lag < 1s (Platform data)

---

## 📈 Roadmap

### Post-MVP (6+ months)
- Video annotation (frame-by-frame + tracking)
- 3D point cloud annotation (LiDAR)
- Active learning (prioritize uncertain samples)
- Real-time collaboration (Google Docs style)
- Mobile/tablet annotation

---

## 📄 License

TBD

---

## 👥 Team

- **Platform Team**: Vision AI Training Platform
- **Labeler Team**: Annotation tool development

---

## 📞 Contact

For questions or issues:
- Open a GitHub issue
- Contact: [your-email@example.com]

---

**Status**: Design Phase Complete ✅ - Ready for Implementation!
