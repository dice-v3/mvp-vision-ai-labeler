# Database Separation Strategy

**Date**: 2025-01-13 (Updated)
**Status**: Architecture Decision
**Version**: 2.0

## Table of Contents

- [Problem Statement](#problem-statement)
- [Option Comparison](#option-comparison)
- [Recommended Approach](#recommended-approach)
- [Implementation Details](#implementation-details)
- [Migration Path](#migration-path)

---

## Problem Statement

**Initial Design**: Shared database with table prefixes
- Platform tables: `users`, `datasets`, `training_jobs`
- Labeler tables: `annotation_projects`, `annotations`
- Both services access same PostgreSQL instance

**Issues with Shared DB**:
1. ❌ **Tight Coupling**: Schema changes require coordination
2. ❌ **Connection Pool Contention**: Labeler's heavy queries affect Platform
3. ❌ **Migration Conflicts**: Alembic migrations can clash
4. ❌ **Security Risk**: Labeler has access to Platform tables
5. ❌ **Scaling Limitations**: Cannot scale databases independently
6. ❌ **Failure Impact**: DB issues affect both services

**Goal**: Separate databases while maintaining data access to Platform's `users` and `datasets`.

---

## Option Comparison

### Option 1: Separate DB + Foreign Data Wrapper (FDW)

**Architecture**:
```
┌─────────────────┐         ┌─────────────────┐
│  Platform DB    │         │  Labeler DB     │
│  (PostgreSQL)   │◄────────│  (PostgreSQL)   │
│                 │   FDW   │                 │
│  - users        │ (read)  │  - annotation_* │
│  - datasets     │         │                 │
│  - training_jobs│         │  FDW views:     │
│  - snapshots    │         │  - users (RO)   │
└─────────────────┘         │  - datasets (RO)│
                            └─────────────────┘
```

**Implementation**:
```sql
-- On Labeler DB
CREATE EXTENSION postgres_fdw;

-- Create server connection
CREATE SERVER platform_db
FOREIGN DATA WRAPPER postgres_fdw
OPTIONS (host 'platform-db-host', dbname 'platform', port '5432');

-- Create user mapping
CREATE USER MAPPING FOR labeler_user
SERVER platform_db
OPTIONS (user 'readonly_user', password 'readonly_pass');

-- Import specific tables (read-only)
IMPORT FOREIGN SCHEMA public
LIMIT TO (users, datasets)
FROM SERVER platform_db
INTO public;

-- Now can query Platform tables from Labeler DB
SELECT * FROM users WHERE id = 123;
SELECT * FROM datasets WHERE owner_id = 123;
```

**Pros**:
- ✅ Appears as local tables (transparent to application)
- ✅ Can use JOINs with local tables
- ✅ No application code changes needed
- ✅ Automatic updates (queries real-time data)
- ✅ PostgreSQL native feature

**Cons**:
- ⚠️ Network latency for every query
- ⚠️ No caching (always queries remote)
- ⚠️ Platform DB must be reachable
- ⚠️ Limited to PostgreSQL-to-PostgreSQL

**When to Use**: Best for low-latency networks (same data center), infrequent queries

---

### Option 2: Separate DB + Read Replica

**Architecture**:
```
┌─────────────────────────────────────────┐
│         Platform DB (Master)            │
│  - users, datasets, training_jobs       │
└────────────┬────────────────────────────┘
             │ Streaming replication
             ▼
┌─────────────────────────────────────────┐
│    Platform DB Read Replica (Standby)   │
│  - users, datasets (read-only)          │
└────────────┬────────────────────────────┘
             │ Read queries
             ▼
    ┌────────────────┐
    │ Labeler Backend│
    └────────────────┘

┌─────────────────────────────────────────┐
│         Labeler DB (Independent)         │
│  - annotation_projects, annotations     │
└─────────────────────────────────────────┘
```

**Implementation**:
```python
# Labeler Backend: Two DB connections

# Connection 1: Platform Read Replica (read-only)
platform_engine = create_engine(
    "postgresql://readonly:pass@platform-replica:5432/platform"
)

# Connection 2: Labeler DB (read-write)
labeler_engine = create_engine(
    "postgresql://labeler:pass@labeler-db:5432/labeler"
)

# Query Platform data
with platform_engine.connect() as conn:
    users = conn.execute("SELECT * FROM users WHERE id = ?", user_id)

# Query Labeler data
with labeler_engine.connect() as conn:
    projects = conn.execute("SELECT * FROM annotation_projects WHERE owner_id = ?", user_id)
```

**Pros**:
- ✅ No impact on Platform DB master
- ✅ Fresh data (replication lag typically < 1s)
- ✅ Can use regular PostgreSQL connections
- ✅ Read replica can be geographically close to Labeler

**Cons**:
- ⚠️ Replication lag (eventual consistency)
- ⚠️ Cannot JOIN across databases in SQL
- ⚠️ Application must handle two connections
- ⚠️ Read replica infrastructure cost

**When to Use**: High read volume, can tolerate small lag, need performance isolation

---

### Option 3: Separate DB + API Calls

**Architecture**:
```
┌─────────────────┐         ┌─────────────────┐
│ Platform Backend│◄────────│ Labeler Backend │
│                 │   HTTP  │                 │
│  ┌───────────┐  │         │  ┌───────────┐  │
│  │Platform DB│  │         │  │Labeler DB │  │
│  │ - users   │  │         │  │ - annot.* │  │
│  │ - datasets│  │         │  └───────────┘  │
│  └───────────┘  │         │                 │
│                 │         │  Cache (Redis): │
│ GET /users/{id} │         │  - users        │
│ GET /datasets   │         │  - datasets     │
└─────────────────┘         └─────────────────┘
```

**Implementation**:
```python
# Labeler Backend

class PlatformAPIClient:
    """Client for Platform API"""

    def __init__(self, base_url: str, service_token: str):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {service_token}"}
        self.cache = RedisCache()

    async def get_user(self, user_id: int) -> User:
        # Check cache first
        cached = await self.cache.get(f"user:{user_id}")
        if cached:
            return User(**cached)

        # Call Platform API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/users/{user_id}",
                headers=self.headers
            )
            user_data = response.json()

        # Cache for 5 minutes
        await self.cache.set(f"user:{user_id}", user_data, ttl=300)

        return User(**user_data)

    async def get_datasets(self, owner_id: int) -> List[Dataset]:
        # Similar caching logic
        ...

# Usage
platform_client = PlatformAPIClient(
    base_url="http://platform-backend:8000",
    service_token=SERVICE_TOKEN
)

user = await platform_client.get_user(user_id)
datasets = await platform_client.get_datasets(user.id)
```

**Pros**:
- ✅ Complete service isolation
- ✅ Clear API contract
- ✅ Caching reduces load
- ✅ No database coupling
- ✅ Easy to add rate limiting, retries

**Cons**:
- ⚠️ HTTP overhead (latency)
- ⚠️ Platform API must be available
- ⚠️ Cache invalidation complexity
- ⚠️ Stale data if cache not invalidated

**When to Use**: Services in different regions, need strong isolation, can tolerate latency

---

### Option 4: Separate DB + Event-Driven Sync

**Architecture**:
```
┌─────────────────────────────────────────┐
│         Platform Backend                 │
│  ┌──────────┐      ┌─────────────────┐  │
│  │Platform  │─────►│ Event Publisher │  │
│  │   DB     │      │ (Redis/Kafka)   │  │
│  └──────────┘      └────────┬────────┘  │
└────────────────────────────┼────────────┘
                             │
                             │ Events:
                             │ - user.created
                             │ - user.updated
                             │ - dataset.created
                             ▼
┌─────────────────────────────────────────┐
│         Labeler Backend                  │
│  ┌─────────────────┐  ┌──────────────┐  │
│  │ Event Subscriber│─►│  Labeler DB  │  │
│  │                 │  │  - users     │  │
│  │                 │  │  - datasets  │  │
│  │                 │  │  - annot.*   │  │
│  └─────────────────┘  └──────────────┘  │
└─────────────────────────────────────────┘
```

**Implementation**:
```python
# Platform Backend: Publish events
from redis import Redis

redis_client = Redis()

def create_user(user_data: UserCreate) -> User:
    # Create in DB
    user = User(**user_data.dict())
    db.add(user)
    db.commit()

    # Publish event
    redis_client.publish('platform.events', json.dumps({
        'event_type': 'user.created',
        'data': user.dict(),
        'timestamp': datetime.utcnow().isoformat()
    }))

    return user

# Labeler Backend: Subscribe to events
import asyncio
from redis.asyncio import Redis

class EventSubscriber:
    async def subscribe(self):
        redis = await Redis()
        pubsub = redis.pubsub()
        await pubsub.subscribe('platform.events')

        async for message in pubsub.listen():
            if message['type'] == 'message':
                event = json.loads(message['data'])
                await self.handle_event(event)

    async def handle_event(self, event: dict):
        if event['event_type'] == 'user.created':
            # Upsert user in Labeler DB
            user_data = event['data']
            user = await db.query(User).filter_by(id=user_data['id']).first()
            if not user:
                user = User(**user_data)
                db.add(user)
            else:
                for key, value in user_data.items():
                    setattr(user, key, value)
            await db.commit()

        elif event['event_type'] == 'dataset.created':
            # Similar logic
            ...
```

**Pros**:
- ✅ Near real-time sync
- ✅ Decoupled services
- ✅ Can replay events (if using Kafka)
- ✅ Labeler DB has full copy (fast queries, JOINs work)

**Cons**:
- ⚠️ Event infrastructure needed (Redis Pub/Sub or Kafka)
- ⚠️ Eventual consistency
- ⚠️ Complexity (event ordering, duplicate handling)
- ⚠️ Initial sync needed (existing data)

**When to Use**: High decoupling needed, multiple consumers, audit trail required

---

## Recommended Approach

### ✅ **Option 2: Separate DB + Read Replica** (Best balance)

**Rationale**:
1. **Performance**: No HTTP overhead, direct DB access
2. **Fresh Data**: Replication lag < 1s (acceptable for most cases)
3. **Isolation**: Labeler queries don't affect Platform DB master
4. **Simplicity**: Standard PostgreSQL feature, no custom code
5. **Scalability**: Can add more read replicas
6. **Cost**: Moderate (just one additional DB instance)

**Architecture**:
```
┌──────────────────────────────────────────────────────────┐
│                   Labeler Backend                        │
│                                                          │
│  Connection Pool 1:                                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Platform Data (Read-Only)                       │    │
│  │ → platform_replica_engine                       │    │
│  │ → SELECT users, datasets                        │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Connection Pool 2:                                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Labeler Data (Read-Write)                       │    │
│  │ → labeler_engine                                │    │
│  │ → CRUD annotation_projects, annotations         │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────┬──────────────────────┬─────────────────────┘
              │                      │
              ▼                      ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│ Platform DB Replica     │  │ Labeler DB (Master)     │
│ (Read-Only Standby)     │  │ (Full Control)          │
│                         │  │                         │
│ - users                 │  │ - annotation_projects   │
│ - datasets              │  │ - annotations           │
│ - snapshots             │  │ - annotation_tasks      │
│                         │  │ - comments              │
└────────┬────────────────┘  └─────────────────────────┘
         │
         │ Streaming Replication
         ▼
┌─────────────────────────┐
│ Platform DB (Master)    │
│ (Platform owns)         │
└─────────────────────────┘
```

---

## Implementation Details

### Database Configuration

**1. Platform DB (Master)**:
```yaml
# Already exists (no changes needed)
postgresql://platform:password@platform-db:5432/platform
```

**2. Platform DB Read Replica**:
```yaml
# New read replica
postgresql://readonly:password@platform-db-replica:5432/platform

# PostgreSQL configuration for standby
standby_mode = on
primary_conninfo = 'host=platform-db port=5432 user=replication password=...'
```

**3. Labeler DB (Independent)**:
```yaml
# Completely separate database
postgresql://labeler:password@labeler-db:5432/labeler
```

### Application Code

**Database Sessions** (SQLAlchemy):
```python
# backend/app/core/database.py

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Platform data (read-only)
platform_engine = create_engine(
    settings.PLATFORM_DB_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True  # Check connection health
)
PlatformSession = sessionmaker(bind=platform_engine)

# Labeler data (read-write)
labeler_engine = create_engine(
    settings.LABELER_DB_URL,
    pool_size=20,
    max_overflow=40
)
LabelerSession = sessionmaker(bind=labeler_engine)

# Dependency injection
def get_platform_db():
    db = PlatformSession()
    try:
        yield db
    finally:
        db.close()

def get_labeler_db():
    db = LabelerSession()
    try:
        yield db
    finally:
        db.close()
```

**Service Layer**:
```python
# backend/app/services/user_service.py

class UserService:
    def __init__(
        self,
        platform_db: Session,  # Read-only replica
        labeler_db: Session    # Labeler DB
    ):
        self.platform_db = platform_db
        self.labeler_db = labeler_db

    def get_user(self, user_id: int) -> User:
        """Get user from Platform DB replica"""
        user = self.platform_db.query(User).filter_by(id=user_id).first()
        if not user:
            raise HTTPException(404, "User not found")
        return user

    def get_user_projects(self, user_id: int) -> List[AnnotationProject]:
        """Get user's projects from Labeler DB"""
        projects = self.labeler_db.query(AnnotationProject)\
            .filter_by(owner_id=user_id)\
            .all()
        return projects

    def create_project(
        self,
        user_id: int,
        project_data: ProjectCreate
    ) -> AnnotationProject:
        """
        Create project (needs data from both DBs)
        """
        # 1. Verify user exists (Platform DB)
        user = self.get_user(user_id)

        # 2. Verify dataset exists (Platform DB)
        dataset = self.platform_db.query(Dataset)\
            .filter_by(id=project_data.dataset_id)\
            .first()
        if not dataset:
            raise HTTPException(404, "Dataset not found")

        # 3. Create project (Labeler DB)
        project = AnnotationProject(
            owner_id=user_id,
            **project_data.dict()
        )
        self.labeler_db.add(project)
        self.labeler_db.commit()

        return project
```

**API Endpoints**:
```python
# backend/app/api/v1/projects.py

from fastapi import Depends

@router.post("/projects")
async def create_project(
    project_data: ProjectCreate,
    platform_db: Session = Depends(get_platform_db),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user)
):
    service = UserService(platform_db, labeler_db)
    project = service.create_project(current_user.id, project_data)
    return project
```

### Handling Replication Lag

**Strategy 1: Accept Eventual Consistency**
```python
# For most queries, small lag is acceptable
user = platform_db.query(User).filter_by(id=user_id).first()
# Lag: 0-1 seconds (acceptable for UI display)
```

**Strategy 2: Critical Reads from Master**
```python
# For critical operations, query master if needed
async def verify_user_before_payment(user_id: int):
    # Use Platform API to ensure fresh data
    response = await http_client.get(f"{PLATFORM_API}/users/{user_id}")
    return response.json()
```

**Strategy 3: Cache with TTL**
```python
# Cache user data in Redis
@cached(ttl=300)  # 5 minutes
def get_user(user_id: int) -> User:
    return platform_db.query(User).filter_by(id=user_id).first()
```

---

## Migration Path

### Phase 1: Setup Labeler DB

```bash
# 1. Create Labeler database
createdb -h labeler-db -U postgres labeler

# 2. Run Labeler migrations
cd labeler/backend
alembic upgrade head

# 3. Verify tables created
psql -h labeler-db -U labeler -d labeler -c "\dt"
```

### Phase 2: Setup Read Replica

**For Development** (Docker Compose):
```yaml
# docker-compose.yml
services:
  platform-db:
    image: postgres:16
    environment:
      POSTGRES_DB: platform
    volumes:
      - platform-db-data:/var/lib/postgresql/data

  platform-db-replica:
    image: postgres:16
    environment:
      POSTGRES_DB: platform
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - replica-data:/var/lib/postgresql/data
    command: |
      bash -c "
        until pg_basebackup -h platform-db -D /var/lib/postgresql/data -U replication -v -P; do
          sleep 1
        done
        echo 'standby_mode = on' >> /var/lib/postgresql/data/recovery.conf
        echo \"primary_conninfo = 'host=platform-db port=5432 user=replication'\" >> /var/lib/postgresql/data/recovery.conf
        postgres
      "

  labeler-db:
    image: postgres:16
    environment:
      POSTGRES_DB: labeler
    volumes:
      - labeler-db-data:/var/lib/postgresql/data
```

**For Production** (Kubernetes/Cloud):
```yaml
# Use managed service read replicas:
# - AWS RDS: Create read replica
# - Google Cloud SQL: Create replica
# - DigitalOcean: Create standby node
```

### Phase 3: Update Application

```python
# Update settings
class Settings(BaseSettings):
    # Old (remove)
    # DATABASE_URL: str

    # New
    PLATFORM_DB_URL: str  # Read replica
    LABELER_DB_URL: str   # Labeler master

# Update all services to use two connections
```

### Phase 4: Test & Deploy

```bash
# Integration tests with dual DB
pytest tests/integration/test_dual_db.py

# Deploy
docker-compose up -d
```

---

## Fallback Plan

If read replica is not available (dev environment):

**Option: Direct connection to Platform DB (read-only user)**
```sql
-- Create read-only user on Platform DB
CREATE USER labeler_readonly WITH PASSWORD 'readonly_pass';
GRANT CONNECT ON DATABASE platform TO labeler_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO labeler_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO labeler_readonly;
```

```python
# Use read-only user instead of replica
PLATFORM_DB_URL = "postgresql://labeler_readonly:pass@platform-db:5432/platform"
```

This gives similar isolation without replication infrastructure.

---

## Cost Comparison

| Option | Infrastructure Cost | Development Cost | Operational Cost |
|--------|---------------------|------------------|------------------|
| **Shared DB** | Low (1 DB) | Low | High (coupling) |
| **FDW** | Low (1 extra DB) | Medium | Medium |
| **Read Replica** | Medium (1 DB + replica) | Medium | Low ✅ |
| **API Calls** | Medium (1 extra DB + cache) | High | Medium |
| **Event-Driven** | High (2 DBs + event system) | High | High |

---

## Recommendation Summary

✅ **Use Option 2: Separate DB + Read Replica**

**Why**:
- Best performance (direct DB access)
- Acceptable lag (< 1s)
- Clear separation of concerns
- Proven pattern (used by Shopify, GitHub, Stripe)
- Easy rollback (can switch to shared DB if needed)

**Implementation Priority**:
1. **Phase 1 (Week 1)**: Shared DB (quick start)
2. **Phase 2 (Week 6)**: Migrate to separate DB + read replica (after core features stable)

This gives flexibility to start fast and migrate later with minimal code changes.

---

## References

- [PostgreSQL Streaming Replication](https://www.postgresql.org/docs/current/warm-standby.html)
- [Foreign Data Wrappers](https://www.postgresql.org/docs/current/postgres-fdw.html)
- [Multi-Database Patterns](https://microservices.io/patterns/data/database-per-service.html)

---

**Last Updated**: 2025-01-13
**Status**: Architecture Decision - Approved
