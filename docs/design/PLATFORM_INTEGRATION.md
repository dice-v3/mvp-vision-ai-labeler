# Platform Integration Strategy

**Date**: 2025-01-13
**Status**: Design
**Version**: 1.0

## Table of Contents

- [Overview](#overview)
- [Integration Points](#integration-points)
- [Integration Options](#integration-options)
- [Recommended Architecture](#recommended-architecture)
- [Implementation Details](#implementation-details)
- [Deployment Scenarios](#deployment-scenarios)
- [Migration Strategy](#migration-strategy)

---

## Overview

Vision AI Labeler는 Vision AI Training Platform의 일부로 작동하며, 다음 리소스를 공유합니다:

**Shared Resources**:
- **Storage**: MinIO (dev) / R2 (prod) - Images & Annotations
- **Database**: PostgreSQL - User accounts, Dataset metadata
- **Authentication**: JWT tokens - User sessions

**Integration Goal**: Maximize resource sharing while maintaining service independence for flexible deployment and maintenance.

---

## Integration Points

### 1. Storage (S3-compatible)

**What Labeler Needs**:
- Read images from existing datasets
- Write annotations (JSON format)
- Generate presigned URLs for browser access
- Create snapshots after annotation

**Platform Storage Structure**:
```
s3://bucket/
├── datasets/{dataset-id}/
│   ├── images/                    ← Labeler reads from here
│   ├── annotations.json           ← Labeler writes/updates
│   └── snapshots/{snapshot-id}.json
└── projects/{project-id}/         ← Platform's training data
```

### 2. Database (PostgreSQL)

**Platform Schema** (existing):
```sql
-- User management
users (id, email, password_hash, ...)

-- Dataset metadata
datasets (id, name, storage_path, num_images, created_at, ...)

-- Training jobs
training_jobs (id, dataset_id, model_name, status, ...)

-- Snapshots
snapshots (id, dataset_id, snapshot_type, created_at, ...)
```

**Labeler Schema** (new):
```sql
-- Annotation projects (Changed: 2025-11-13 - 1:1 with datasets)
annotation_projects (id, dataset_id UNIQUE, task_type, classes, ...)

-- Annotations (for fast queries)
annotations (id, project_id, image_id, geometry, class_id, ...)

-- Tasks & assignments
annotation_tasks (id, project_id, assignee_id, image_ids, ...)

-- Comments & collaboration
comments (id, project_id, image_id, user_id, text, ...)
```

### 3. Authentication

**Platform Auth Flow**:
```
1. User logs in → Platform Backend
2. Platform generates JWT token
3. Token contains: user_id, email, roles, exp
4. Token signed with JWT_SECRET
```

**Labeler Auth Requirements**:
- Validate JWT tokens from Platform
- Use same JWT_SECRET
- Decode user info from token
- No separate login required

---

## Integration Options

### Option 1: Separate Services (Microservices)

```
┌─────────────────────────────────────────────────────────────────┐
│                          User Browser                            │
└────────────┬────────────────────────────────┬───────────────────┘
             │                                │
             │ (JWT token)                    │ (JWT token)
             ▼                                ▼
┌──────────────────────┐           ┌──────────────────────┐
│  Platform Backend    │           │  Labeler Backend     │
│  (FastAPI)           │           │  (FastAPI)           │
│  :8000               │           │  :8001               │
└──────────┬───────────┘           └──────────┬───────────┘
           │                                  │
           ├──────────────────────────────────┤
           │         Shared Resources          │
           ▼                                  ▼
┌──────────────────┐ ┌─────────────┐ ┌───────────────┐
│  PostgreSQL      │ │   Redis     │ │  MinIO/R2     │
│  :5432           │ │   :6379     │ │  :9000        │
│                  │ │             │ │               │
│  ┌─────────────┐ │ │             │ │  datasets/    │
│  │Platform DB  │ │ │             │ │  images/      │
│  │Labeler DB   │ │ │             │ │  annotations/ │
│  └─────────────┘ │ │             │ │               │
└──────────────────┘ └─────────────┘ └───────────────┘
```

**Characteristics**:
- Two separate backend services
- Shared database (different schemas/tables)
- Shared storage (S3)
- Shared Redis (different key prefixes)
- JWT token shared (same secret)

**Pros**:
- ✅ Independent deployment (can update Labeler without Platform)
- ✅ Isolated failures (Labeler crash doesn't affect Platform)
- ✅ Scalable (can scale Labeler independently)
- ✅ Clear ownership (Labeler owns annotation tables)
- ✅ Technology flexibility (could use different frameworks)

**Cons**:
- ❌ Two services to maintain
- ❌ Slight network overhead for shared data
- ❌ Need to coordinate database migrations
- ❌ More complex deployment

**When to Use**: Production environment, team size > 3, long-term maintenance

---

### Option 2: Monolithic Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                          User Browser                            │
└────────────────────────────────┬───────────────────────────────┘
                                 │ (JWT token)
                                 ▼
                    ┌──────────────────────────┐
                    │  Platform Backend        │
                    │  (FastAPI)               │
                    │  :8000                   │
                    │                          │
                    │  ┌────────────────────┐  │
                    │  │  /api/v1/training  │  │
                    │  │  /api/v1/datasets  │  │
                    │  │  /api/v1/labeling  │◄─┼─ New routes
                    │  └────────────────────┘  │
                    └──────────┬───────────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
         ┌────────────┐  ┌─────────┐  ┌───────────┐
         │ PostgreSQL │  │  Redis  │  │  MinIO/R2 │
         └────────────┘  └─────────┘  └───────────┘
```

**Characteristics**:
- Labeler functionality added to Platform backend
- Single FastAPI application
- New route prefix `/api/v1/labeling`

**Pros**:
- ✅ Simple deployment (one service)
- ✅ Shared code (utilities, auth, storage)
- ✅ No network overhead
- ✅ Easier database transactions

**Cons**:
- ❌ Tight coupling (changes to one affect the other)
- ❌ Single point of failure
- ❌ Harder to scale independently
- ❌ Deployment requires full platform restart

**When to Use**: Early development, small team, rapid prototyping

---

### Option 3: Hybrid (Separate Frontend, Shared Backend)

```
┌────────────────────┐              ┌────────────────────┐
│ Platform Frontend  │              │ Labeler Frontend   │
│ (Next.js :3000)    │              │ (Next.js :3001)    │
└─────────┬──────────┘              └─────────┬──────────┘
          │                                   │
          └───────────────┬───────────────────┘
                          │ (API calls)
                          ▼
              ┌──────────────────────────┐
              │  Platform Backend        │
              │  (FastAPI :8000)         │
              │                          │
              │  /api/v1/training        │
              │  /api/v1/labeling  ◄───────── New module
              └──────────┬───────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌────────────┐  ┌─────────┐  ┌───────────┐
   │ PostgreSQL │  │  Redis  │  │  MinIO/R2 │
   └────────────┘  └─────────┘  └───────────┘
```

**Characteristics**:
- Separate frontend applications
- Single backend with labeling module
- Two different UIs, one API

**Pros**:
- ✅ Independent frontend development
- ✅ Shared backend logic
- ✅ Simple deployment (one backend)

**Cons**:
- ❌ Backend coupling (same as Option 2)
- ❌ Two frontends to maintain

**When to Use**: Different UX requirements, separate frontend teams

---

## Recommended Architecture

### ✅ **Option 1: Separate Services (Microservices)**

**Rationale**:
1. **Independence**: Labeler can be developed, tested, deployed independently
2. **Scalability**: Labeling workload is different from training workload
3. **Failure Isolation**: Issues in labeler don't affect training pipeline
4. **Team Structure**: Platform team and Labeler team can work in parallel
5. **Long-term Maintenance**: Easier to maintain, upgrade, debug

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Browser                                 │
│  ┌────────────────────┐            ┌──────────────────────┐         │
│  │ Platform Frontend  │            │  Labeler Frontend    │         │
│  │ http://platform.ai │            │  http://label.ai     │         │
│  └─────────┬──────────┘            └──────────┬───────────┘         │
└────────────┼─────────────────────────────────┼─────────────────────┘
             │                                  │
             │ JWT: platform-token              │ JWT: same token
             ▼                                  ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│  Platform Backend        │      │  Labeler Backend         │
│  (FastAPI :8000)         │      │  (FastAPI :8001)         │
│                          │      │                          │
│  Endpoints:              │      │  Endpoints:              │
│  - /api/v1/auth         │◄─────┼─┐ Reuse JWT validation   │
│  - /api/v1/training     │      │ │ - /api/v1/projects     │
│  - /api/v1/datasets ────┼──────┼─┤ Read dataset list      │
│  - /api/v1/users        │      │ │ - /api/v1/annotations  │
│                          │      │ │ - /api/v1/export       │
└──────────┬───────────────┘      └─┼────────┬───────────────┘
           │                        │        │
           │  ┌─────────────────────┘        │
           │  │  ┌──────────────────────────┘
           ▼  ▼  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Shared Infrastructure                         │
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  PostgreSQL :5432    │  │  Redis :6379 │  │  MinIO :9000     │ │
│  │                      │  │              │  │                  │ │
│  │  Database: platform  │  │  Namespaces: │  │  Bucket: vision  │ │
│  │                      │  │  - platform: │  │                  │ │
│  │  Schema:             │  │  - labeler:  │  │  Keys:           │ │
│  │  - users (shared)    │  │              │  │  - datasets/     │ │
│  │  - datasets (shared) │  │              │  │  - images/       │ │
│  │  - training_jobs     │  │              │  │  - annotations/  │ │
│  │  - snapshots (shared)│  │              │  │                  │ │
│  │                      │  │              │  │                  │ │
│  │  - annotation_*      │  │              │  │                  │ │
│  │    (labeler only)    │  │              │  │                  │ │
│  └──────────────────────┘  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Resource Access Matrix

| Resource | Platform Backend | Labeler Backend | Access Method |
|----------|-----------------|-----------------|---------------|
| **Users Table** | Read/Write (master) | Read-only | Platform DB replica |
| **Datasets Table** | Read/Write (master) | Read-only | Platform DB replica |
| **Snapshots Table** | Read/Write (master) | Read/Write | Platform DB replica (read) + Labeler DB (write) |
| **Training Jobs** | Read/Write (master) | None | N/A |
| **Annotation Projects** | None | Read/Write | Labeler DB (full control) |
| **Annotations** | None | Read/Write | Labeler DB (full control) |
| **Annotation Tasks** | None | Read/Write | Labeler DB (full control) |
| **Comments** | None | Read/Write | Labeler DB (full control) |
| **S3 Images** | Read/Write | Read-only | Direct S3 access |
| **S3 Annotations** | Read | Read/Write | Direct S3 access |
| **S3 Snapshots** | Read/Write | Read/Write | Direct S3 access |

**Note**: Labeler reads Platform data from read replica (< 1s lag), writes only to Labeler DB

---

## Implementation Details

### 1. Database Schema Strategy

**Approach: Separate Databases + Read Replica** ⭐ (Updated)

```
┌─────────────────────────────────────────┐
│     Platform DB (Master)                │
│  - users, datasets, training_jobs       │
└────────────┬────────────────────────────┘
             │ Streaming Replication
             ▼
┌─────────────────────────────────────────┐
│  Platform DB Read Replica (Standby)     │
│  - users, datasets (read-only)          │
└────────────┬────────────────────────────┘
             │ Labeler queries here
             ▼
      ┌──────────────┐
      │Labeler Backend│
      └──────┬────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│     Labeler DB (Independent)            │
│  - annotation_projects, annotations     │
│  - annotation_tasks, comments           │
└─────────────────────────────────────────┘
```

**Why Separate?**:
- ✅ **Complete Independence**: Labeler DB failures don't affect Platform
- ✅ **Performance Isolation**: Heavy annotation queries don't impact Platform
- ✅ **Independent Scaling**: Scale each DB based on its workload
- ✅ **Security**: Labeler cannot modify Platform data
- ✅ **Migration Independence**: No coordination needed for schema changes

**Connection Configuration**:
```python
# Platform DB replica (read-only)
PLATFORM_DB_URL = postgresql://readonly:pass@platform-db-replica:5432/platform

# Labeler DB (full control)
LABELER_DB_URL = postgresql://labeler:pass@labeler-db:5432/labeler

# Two engines in Labeler backend
platform_engine = create_engine(PLATFORM_DB_URL)  # Read users, datasets
labeler_engine = create_engine(LABELER_DB_URL)    # Read/write annotations
```

**Data Access Patterns**:
```python
# Service layer uses both connections
class UserService:
    def __init__(self, platform_db: Session, labeler_db: Session):
        self.platform_db = platform_db  # Read-only replica
        self.labeler_db = labeler_db    # Full access

    def create_project(self, user_id: int, data: ProjectCreate):
        # 1. Verify user (Platform DB replica)
        user = self.platform_db.query(User).filter_by(id=user_id).first()

        # 2. Verify dataset (Platform DB replica)
        dataset = self.platform_db.query(Dataset).filter_by(id=data.dataset_id).first()

        # 3. Create project (Labeler DB)
        project = AnnotationProject(owner_id=user_id, **data.dict())
        self.labeler_db.add(project)
        self.labeler_db.commit()

        return project
```

**Replication Lag Handling**:
- Typical lag: < 1 second (acceptable for UI)
- For critical reads: Use Platform API if fresh data required
- Cache user/dataset data in Redis (5 min TTL)

**Migration Strategy**:
```bash
# Platform migrations (unchanged)
cd platform/backend
alembic upgrade head

# Labeler migrations (independent)
cd labeler/backend
alembic upgrade head
```

**Benefits**:
- ✅ Complete service isolation
- ✅ No cross-service schema conflicts
- ✅ Independent backup/restore
- ✅ Can use different PostgreSQL versions if needed
- ✅ Fresh data (replication lag < 1s)

**See**: [Database Separation Strategy](./DATABASE_SEPARATION_STRATEGY.md) for detailed comparison of 4 options

---

### 2. Storage Access Strategy

**Approach: Direct S3 Access (Shared Credentials)**

```python
# Shared: infrastructure/.env
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=vision-platform

# Both backends use same S3 client
import boto3

s3_client = boto3.client(
    's3',
    endpoint_url=os.getenv('R2_ENDPOINT'),
    aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY')
)
```

**Access Patterns**:

| Operation | Platform Backend | Labeler Backend |
|-----------|-----------------|-----------------|
| Upload images | ✅ (dataset creation) | ❌ |
| Read images | ✅ | ✅ (for labeling) |
| Generate presigned URLs | ✅ | ✅ (for browser) |
| Write annotations.json | ❌ | ✅ |
| Read annotations.json | ✅ (for training) | ✅ (for editing) |
| Create snapshots | ✅ (training) | ✅ (after labeling) |

**Conflict Resolution**:
- **annotations.json**: Labeler writes, Platform reads (read-only for training)
- **snapshots/**: Both write, but different snapshot IDs (training-job-* vs manual-*)
- **images/**: Platform writes once, both read (immutable after creation)

**Optimistic Locking** (for annotations.json):
```json
{
  "format_version": "1.0",
  "dataset_id": "dataset-123",
  "updated_at": "2025-01-13T10:00:00Z",
  "updated_by": "labeler-service",
  "version": 42,  // Increment on each save
  "images": [...]
}
```

---

### 3. Authentication Strategy

**Approach: Shared JWT Secret**

```python
# Shared: .env
JWT_SECRET=your-super-secret-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Platform: Generate token on login
from jose import jwt

def create_access_token(user_id: int, email: str):
    payload = {
        "sub": str(user_id),
        "email": email,
        "roles": ["user"],  # or ["admin"]
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# Labeler: Validate token
from jose import jwt, JWTError

def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
        email = payload["email"]
        return {"user_id": user_id, "email": email}
    except JWTError:
        raise HTTPException(401, "Invalid token")
```

**Auth Flow**:
```
1. User visits Platform (http://platform.ai)
   → Login → Platform Backend generates JWT

2. User navigates to Labeler (http://label.ai)
   → Labeler Frontend sends same JWT token
   → Labeler Backend validates using shared JWT_SECRET
   → No separate login required

3. Token stored in browser:
   - localStorage.setItem('token', jwt_token)
   - Both frontends read from same key
   - OR: Use cookies with shared domain (.platform.ai)
```

**Security Considerations**:
- ✅ Token expiration (24 hours)
- ✅ HTTPS only (prevent token sniffing)
- ✅ Refresh tokens for long sessions
- ✅ Token revocation (blacklist in Redis)

**Redis Token Blacklist**:
```python
# Logout: Add token to blacklist
redis_client.setex(
    f"blacklist:{token_hash}",
    ex=86400,  # 24 hours
    value="revoked"
)

# Verify: Check blacklist
if redis_client.exists(f"blacklist:{token_hash}"):
    raise HTTPException(401, "Token revoked")
```

---

### 4. Cross-Service Communication

**When Labeler Needs Platform Data**:

```python
# Option A: Direct DB Query (Recommended)
# Labeler reads from shared tables
from sqlalchemy import select

async def get_datasets(user_id: int):
    query = select(Dataset).where(Dataset.owner_id == user_id)
    result = await db.execute(query)
    return result.scalars().all()

# Option B: HTTP API Call (if needed)
# Labeler calls Platform API
import httpx

async def get_training_jobs(dataset_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{PLATFORM_API_URL}/api/v1/training/jobs",
            params={"dataset_id": dataset_id},
            headers={"Authorization": f"Bearer {service_token}"}
        )
        return response.json()
```

**When to Use Each**:
- **Direct DB**: Read-only queries, frequently accessed data (datasets, users)
- **HTTP API**: Cross-service operations, when backend logic is needed

**Service-to-Service Auth**:
```python
# Generate long-lived service token (not user token)
SERVICE_TOKEN = jwt.encode(
    {"sub": "labeler-service", "exp": datetime.utcnow() + timedelta(days=365)},
    JWT_SECRET,
    algorithm=JWT_ALGORITHM
)

# Labeler calls Platform with service token
headers = {"Authorization": f"Bearer {SERVICE_TOKEN}"}
```

---

## Deployment Scenarios

### Development (Docker Compose)

```yaml
# docker-compose.yml (shared infrastructure)
version: '3.8'

services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: platform
      POSTGRES_USER: platform
      POSTGRES_PASSWORD: platform

  redis:
    image: redis:7
    ports: ["6379:6379"]

  minio:
    image: minio/minio
    ports: ["9000:9000", "9001:9001"]
    command: server /data --console-address ":9001"

  platform-backend:
    build: ./platform/backend
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://platform:platform@postgres:5432/platform
      R2_ENDPOINT: http://minio:9000
      JWT_SECRET: dev-secret

  platform-frontend:
    build: ./platform/frontend
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000

  labeler-backend:
    build: ./labeler/backend
    ports: ["8001:8001"]
    environment:
      DATABASE_URL: postgresql://platform:platform@postgres:5432/platform
      R2_ENDPOINT: http://minio:9000
      JWT_SECRET: dev-secret  # Same as platform

  labeler-frontend:
    build: ./labeler/frontend
    ports: ["3001:3001"]
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8001

networks:
  default:
    name: vision-platform
```

**Start Everything**:
```bash
docker-compose up -d
# Access:
# - Platform: http://localhost:3000
# - Labeler: http://localhost:3001
# - MinIO Console: http://localhost:9001
```

---

### Production (Kubernetes)

```yaml
# Shared infrastructure (already exists from Platform)
apiVersion: v1
kind: Namespace
metadata:
  name: platform

---
# Labeler Backend Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: labeler-backend
  namespace: platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: labeler-backend
  template:
    metadata:
      labels:
        app: labeler-backend
    spec:
      containers:
      - name: labeler-backend
        image: ghcr.io/yourorg/labeler-backend:latest
        ports:
        - containerPort: 8001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: platform-secrets
              key: database-url
        - name: R2_ENDPOINT
          valueFrom:
            secretKeyRef:
              name: platform-secrets
              key: r2-endpoint
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: platform-secrets
              key: jwt-secret

---
# Labeler Backend Service
apiVersion: v1
kind: Service
metadata:
  name: labeler-backend
  namespace: platform
spec:
  selector:
    app: labeler-backend
  ports:
  - port: 8001
    targetPort: 8001

---
# Labeler Frontend Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: labeler-frontend
  namespace: platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: labeler-frontend
  template:
    metadata:
      labels:
        app: labeler-frontend
    spec:
      containers:
      - name: labeler-frontend
        image: ghcr.io/yourorg/labeler-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_API_URL
          value: https://api-labeler.yourdomain.com

---
# Ingress (expose to internet)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: labeler-ingress
  namespace: platform
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - labeler.yourdomain.com
    - api-labeler.yourdomain.com
    secretName: labeler-tls
  rules:
  - host: labeler.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: labeler-frontend
            port:
              number: 3000
  - host: api-labeler.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: labeler-backend
            port:
              number: 8001
```

---

## Migration Strategy

### Phase 1: Database Schema Setup

```bash
# 1. Run Platform migrations (ensure base schema exists)
cd platform/backend
alembic upgrade head

# 2. Run Labeler migrations (add annotation tables)
cd labeler/backend
alembic upgrade head

# Result: Single database with all tables
```

### Phase 2: Storage Structure Setup

```python
# Create labeler-specific folders in existing S3 bucket
# (automatically created on first annotation save)

# Structure:
# datasets/{dataset-id}/
#   images/           ← Already exists (Platform)
#   annotations.json  ← Created by Labeler
#   snapshots/        ← Shared by both
```

### Phase 3: Authentication Integration

```python
# Labeler reads JWT_SECRET from environment
# No migration needed - just configuration

# Shared secret in Kubernetes:
kubectl create secret generic platform-secrets \
  --from-literal=jwt-secret=<same-as-platform> \
  --namespace=platform
```

### Phase 4: Testing Integration

```python
# Test checklist:
# 1. User login in Platform → token works in Labeler ✓
# 2. Dataset created in Platform → visible in Labeler ✓
# 3. Annotations saved in Labeler → readable by Platform ✓
# 4. Snapshot created in Labeler → usable for training ✓
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Database schema conflicts** | Use table prefixes, document shared tables |
| **Storage write conflicts** | Define clear ownership, use optimistic locking |
| **JWT secret exposure** | Use Kubernetes secrets, rotate periodically |
| **Database connection pool exhaustion** | Separate connection pools, monitor usage |
| **Migration coordination** | Version control migrations, test on staging |
| **Service discovery in K8s** | Use Kubernetes services, health checks |

---

## Benefits of Recommended Architecture

1. **✅ Independence**: Deploy, scale, update Labeler without affecting Platform
2. **✅ Resource Efficiency**: Share expensive resources (DB, Storage)
3. **✅ Security**: Single authentication system, centralized user management
4. **✅ Data Consistency**: Direct DB access avoids sync issues
5. **✅ Simplicity**: No complex service mesh or API gateway needed
6. **✅ Performance**: Low latency (direct DB, no HTTP overhead for data)
7. **✅ Flexibility**: Can switch to full microservices later if needed

---

## References

- [Platform Architecture Overview](../../mvp-vision-ai-platform/platform/docs/architecture/OVERVIEW.md)
- [Platform Backend Design](../../mvp-vision-ai-platform/platform/docs/architecture/BACKEND_DESIGN.md)
- [Dataset Storage Strategy](../../mvp-vision-ai-platform/platform/docs/architecture/DATASET_STORAGE_STRATEGY.md)

---

## Change Log

- **2025-11-13**: Simplified dataset:project relationship
  - Changed from 1:N to 1:1 (one dataset = one annotation project)
  - Updated schema to use UNIQUE constraint on dataset_id
  - Reduces complexity for MVP deployment

---

**Last Updated**: 2025-11-13
**Status**: Design (updated)
