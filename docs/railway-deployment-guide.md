# Railway Deployment Guide

**Date**: 2025-11-25
**Status**: 📋 Planning
**Context**: Progressive migration to Railway with Cloudflare R2

---

## Overview

이 문서는 mvp-vision-ai-labeler를 Railway로 배포하는 단계별 가이드입니다. Platform 팀의 User DB 마이그레이션에 맞춰 순차적으로 진행합니다.

### Deployment Sequence

1. **User DB → Railway** (Platform 팀) + Labeler 연동 ✅ Complete
2. **Labeler DB → Railway** + Labeler 연동
3. **S3 Internal → Cloudflare R2** + Labeler 연동
4. **S3 External → R2** + Labeler 연동
5. **Labeler Backend/Frontend → Railway**

---

## Current Architecture (AS-IS)

```
┌─────────────────────────────────────────────────┐
│ Local Development                                │
│                                                  │
│  User DB (5433)          Labeler DB (5435)      │
│  PostgreSQL              PostgreSQL             │
│  ├─ users                ├─ annotations         │
│  ├─ organizations        ├─ projects            │
│  └─ invitations          ├─ image_locks         │
│                          ├─ project_permissions │
│                          └─ image_metadata      │
│                                                  │
│  MinIO (9000-9001)                              │
│  ├─ datasets (images + thumbnails)              │
│  └─ annotations (exports)                       │
└─────────────────────────────────────────────────┘
```

---

## Target Architecture (TO-BE)

```
┌─────────────────────────────────────────────────┐
│ Railway Cloud                                    │
│                                                  │
│  User DB                 Labeler DB             │
│  (Platform)              (Labeler)              │
│  PostgreSQL              PostgreSQL             │
│  railway.app             railway.app            │
│                                                  │
│  Cloudflare R2                                  │
│  ├─ datasets (images + thumbnails)              │
│  └─ annotations (exports)                       │
│                                                  │
│  Backend                 Frontend               │
│  FastAPI                 Next.js                │
│  railway.app             railway.app            │
└─────────────────────────────────────────────────┘
```

---

## Phase 1: User DB Railway Integration ✅ COMPLETE

**Status**: ✅ Complete (2025-11-23)
**Owner**: Platform Team (DB migration) + Labeler Team (integration)
**Duration**: 6 hours (Labeler integration)

### 1.1 Platform Team Responsibilities ✅
- [x] User DB 생성 (Railway PostgreSQL)
- [x] User, Organization, Invitation 테이블 마이그레이션
- [x] Railway URL 제공 (`USER_DB_URL`)

### 1.2 Labeler Integration ✅
- [x] 환경 변수 추가 (`USER_DB_HOST`, `USER_DB_PORT`, `USER_DB_NAME`)
- [x] `get_user_db()` 세션 팩토리 구현
- [x] User 모델 분리 (`backend/app/db/models/user.py`)
- [x] API 엔드포인트 업데이트 (33개 User 쿼리)
  - [x] auth.py (login, /auth/me)
  - [x] annotations.py (8 User queries)
  - [x] projects.py (1 User query)
  - [x] image_locks.py (5 User queries)
  - [x] export.py (1 User query)
  - [x] project_permissions.py (5 User queries)
  - [x] datasets.py (12 User queries)
  - [x] users.py (user search)
  - [x] invitations.py (invitation CRUD)
- [x] 통합 테스트 (로그인, 데이터셋, 인증)

### 1.3 Configuration

```bash
# .env
USER_DB_HOST=containers-us-west-xxx.railway.app
USER_DB_PORT=5432
USER_DB_NAME=railway
USER_DB_USER=postgres
USER_DB_PASSWORD=xxx
```

### 1.4 Verification

```bash
# Test endpoints
curl http://localhost:8011/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
curl http://localhost:8011/api/v1/datasets

# Check logs
# All User queries should route to User DB (port 5433)
```

---

## Phase 2: Labeler DB Railway Migration

**Status**: ⏸️ Pending
**Owner**: Labeler Team
**Duration**: 8-10 hours
**Priority**: High

### 2.1 Railway Setup (2h)

#### 2.1.1 Create Railway Project
```bash
# Railway CLI
railway login
railway init
railway add postgresql
```

#### 2.1.2 Get Database Credentials
Railway will auto-generate:
- `DATABASE_URL`
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`

Copy these to `.env.railway`:
```bash
LABELER_DB_HOST=containers-us-west-yyy.railway.app
LABELER_DB_PORT=5432
LABELER_DB_NAME=railway
LABELER_DB_USER=postgres
LABELER_DB_PASSWORD=yyy
```

### 2.2 Schema Migration (2h)

#### 2.2.1 Run Alembic Migrations
```bash
cd backend

# Set Railway DB URL
export LABELER_DB_URL="postgresql://postgres:yyy@containers-us-west-yyy.railway.app:5432/railway"

# Apply migrations
alembic upgrade head

# Verify tables
psql $LABELER_DB_URL -c "\dt"
```

Expected tables:
- `alembic_version`
- `annotation_projects`
- `annotations`
- `annotation_history`
- `annotation_tasks`
- `comments`
- `image_metadata`
- `image_locks`
- `project_permissions`

#### 2.2.2 Verify Indexes
```bash
psql $LABELER_DB_URL -c "
  SELECT tablename, indexname
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname;
"
```

### 2.3 Data Migration (2-3h)

#### 2.3.1 Backup Local Data
```bash
# Backup Labeler DB
pg_dump -h localhost -p 5435 -U labeler_user -d labeler \
  --format=custom \
  --file=labeler_backup_$(date +%Y%m%d_%H%M%S).dump

# Backup critical tables only (faster)
pg_dump -h localhost -p 5435 -U labeler_user -d labeler \
  --table=annotations \
  --table=annotation_projects \
  --table=image_metadata \
  --table=project_permissions \
  --format=custom \
  --file=labeler_critical_$(date +%Y%m%d_%H%M%S).dump
```

#### 2.3.2 Restore to Railway
```bash
# Full restore
pg_restore -h containers-us-west-yyy.railway.app \
  -p 5432 -U postgres -d railway \
  --clean --if-exists \
  labeler_backup_*.dump

# Verify row counts
psql $LABELER_DB_URL -c "
  SELECT
    'annotations' as table, COUNT(*) as rows FROM annotations
  UNION ALL
  SELECT 'annotation_projects', COUNT(*) FROM annotation_projects
  UNION ALL
  SELECT 'image_metadata', COUNT(*) FROM image_metadata
  UNION ALL
  SELECT 'project_permissions', COUNT(*) FROM project_permissions;
"
```

### 2.4 Update Application Config (1h)

#### 2.4.1 Environment Variables
Update `.env`:
```bash
# Labeler DB (Railway)
LABELER_DB_HOST=containers-us-west-yyy.railway.app
LABELER_DB_PORT=5432
LABELER_DB_NAME=railway
LABELER_DB_USER=postgres
LABELER_DB_PASSWORD=yyy

# Or use DATABASE_URL directly
DATABASE_URL=postgresql://postgres:yyy@containers-us-west-yyy.railway.app:5432/railway
```

#### 2.4.2 Connection Pool Tuning
Update `backend/app/core/config.py`:
```python
class Settings(BaseSettings):
    # Railway PostgreSQL connection pool
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 3600  # 1 hour
```

Update `backend/app/core/database.py`:
```python
LabelerEngine = create_engine(
    settings.LABELER_DB_URL,
    poolclass=QueuePool,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,
)
```

### 2.5 Testing (2h)

#### 2.5.1 Smoke Tests
```bash
# Start backend with Railway DB
cd backend
source venv/Scripts/activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8011

# Test critical endpoints
curl http://localhost:8011/health
curl http://localhost:8011/api/v1/datasets -H "Authorization: Bearer $TOKEN"
curl http://localhost:8011/api/v1/projects/{id}/images -H "Authorization: Bearer $TOKEN"
```

#### 2.5.2 Performance Benchmark
```bash
# Measure latency increase
# Target: < 10% slower than local DB

# Test annotation load time
time curl http://localhost:8011/api/v1/annotations/project/{id}

# Test image list load time
time curl http://localhost:8011/api/v1/projects/{id}/images
```

### 2.6 Rollback Plan

If migration fails:
```bash
# 1. Revert .env to local DB
LABELER_DB_HOST=localhost
LABELER_DB_PORT=5435

# 2. Restart backend
# 3. Verify local DB is intact
psql -h localhost -p 5435 -U labeler_user -d labeler -c "SELECT COUNT(*) FROM annotations;"
```

---

## Phase 3: S3 Internal → Cloudflare R2

**Status**: ⏸️ Pending
**Owner**: Labeler Team
**Duration**: 6-8 hours
**Priority**: Medium

### 3.1 Cloudflare R2 Setup (1h)

#### 3.1.1 Create R2 Account & Bucket
1. Go to Cloudflare Dashboard → R2
2. Create bucket: `labeler-datasets`
3. Create API token with R2 permissions

#### 3.1.2 Get Credentials
```bash
# R2 credentials
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=yyy
R2_ENDPOINT=https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
```

#### 3.1.3 Configure CORS
R2 Dashboard → Bucket Settings → CORS:
```json
{
  "AllowedOrigins": ["http://localhost:3010", "https://yourdomain.com"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3600
}
```

### 3.2 Update Application Config (1h)

#### 3.2.1 Environment Variables
Update `.env`:
```bash
# Storage: Cloudflare R2
S3_ENDPOINT=https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
S3_ACCESS_KEY=${R2_ACCESS_KEY_ID}
S3_SECRET_KEY=${R2_SECRET_ACCESS_KEY}
S3_BUCKET_DATASETS=labeler-datasets
S3_BUCKET_ANNOTATIONS=labeler-annotations
S3_REGION=auto  # R2 uses 'auto'
S3_USE_SSL=true
```

#### 3.2.2 Verify Storage Client
No code changes needed! `backend/app/core/storage.py` uses boto3 which is S3-compatible.

Test connection:
```python
from app.core.storage import storage_client

# List buckets
response = storage_client.list_buckets()
print(response)
```

### 3.3 Data Migration: MinIO → R2 (2-3h)

#### 3.3.1 Install rclone
```bash
# Windows
choco install rclone

# Mac
brew install rclone
```

#### 3.3.2 Configure rclone
```bash
rclone config

# MinIO config
[minio]
type = s3
provider = Minio
access_key_id = minioadmin
secret_access_key = minioadmin
endpoint = http://localhost:9000

# R2 config
[r2]
type = s3
provider = Cloudflare
access_key_id = ${R2_ACCESS_KEY_ID}
secret_access_key = ${R2_SECRET_ACCESS_KEY}
endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
```

#### 3.3.3 Sync Datasets Bucket
```bash
# Dry run first
rclone sync minio:datasets r2:labeler-datasets --dry-run --progress

# Actual sync
rclone sync minio:datasets r2:labeler-datasets --progress

# Verify integrity
rclone check minio:datasets r2:labeler-datasets
```

Expected structure:
```
labeler-datasets/
  ├── {dataset_id}/
  │   ├── images/
  │   │   ├── image1.jpg
  │   │   └── image2.jpg
  │   └── thumbnails/
  │       ├── image1.jpg (256x256)
  │       └── image2.jpg (256x256)
```

### 3.4 Testing (1-2h)

#### 3.4.1 Image Load Test
```bash
# Test presigned URL generation
curl http://localhost:8011/api/v1/projects/{id}/images -H "Authorization: Bearer $TOKEN"

# Verify URLs start with R2 endpoint
# https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/...
```

#### 3.4.2 Frontend Test
1. Open http://localhost:3010
2. Navigate to project
3. Verify images load correctly
4. Check browser DevTools Network tab for R2 URLs

#### 3.4.3 Upload Test
```python
# Test image upload
import requests

response = requests.post(
    "http://localhost:8011/api/v1/datasets/{id}/images",
    files={"file": open("test.jpg", "rb")},
    headers={"Authorization": f"Bearer {token}"}
)
```

### 3.5 Migration Notes

**Key Points**:
- ✅ **Zero DB Changes**: 상대 경로만 저장 (`s3_key = "datasets/{id}/image.jpg"`)
- ✅ **S3-Compatible API**: boto3가 R2를 자동 지원
- ✅ **환경 변수만 변경**: 코드 수정 불필요
- ✅ **무료 Egress**: R2는 송출 비용 없음

**Performance**:
- Presigned URL generation: 동일 (서버에서 생성)
- Image load time: CDN 캐싱으로 더 빠를 수 있음

---

## Phase 4: S3 External → R2

**Status**: ⏸️ Pending
**Owner**: Labeler Team
**Duration**: 4-5 hours
**Priority**: Medium

### 4.1 Create Annotations Bucket (30min)

#### 4.1.1 R2 Bucket Setup
Create second bucket: `labeler-annotations`

#### 4.1.2 Environment Variables
Already configured in Phase 3:
```bash
S3_BUCKET_ANNOTATIONS=labeler-annotations
```

### 4.2 Data Migration (2-3h)

#### 4.2.1 Sync Annotations Bucket
```bash
# Sync exports
rclone sync minio:annotations r2:labeler-annotations --progress

# Verify
rclone check minio:annotations r2:labeler-annotations
```

Expected structure:
```
labeler-annotations/
  └── {project_id}/
      └── exports/
          ├── coco_20251123.json
          ├── yolo_20251123.zip
          └── pascal_voc_20251123.zip
```

### 4.3 Testing (1h)

#### 4.3.1 Export Test
```bash
# Test COCO export
curl -X POST http://localhost:8011/api/v1/export \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1, "format": "coco"}'

# Verify file in R2
# Should return presigned URL for R2
```

#### 4.3.2 Download Test
1. Generate export via API
2. Click download link
3. Verify file downloads correctly

---

## Phase 5: Backend/Frontend Railway Deployment

**Status**: ⏸️ Pending
**Owner**: Labeler Team
**Duration**: 8-12 hours
**Priority**: High

### 5.1 Backend Deployment (4-6h)

#### 5.1.1 Create railway.toml
Create `backend/railway.toml`:
```toml
[build]
builder = "NIXPACKS"
buildCommand = "pip install -r requirements.txt"

[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[healthcheck]
path = "/health"
timeout = 100
interval = 60
```

#### 5.1.2 Railway Environment Variables
Set in Railway dashboard:
```bash
# User DB (from Platform)
USER_DB_HOST=xxx.railway.app
USER_DB_PORT=5432
USER_DB_NAME=railway
USER_DB_USER=postgres
USER_DB_PASSWORD=xxx

# Labeler DB
LABELER_DB_HOST=yyy.railway.app
LABELER_DB_PORT=5432
LABELER_DB_NAME=railway
LABELER_DB_USER=postgres
LABELER_DB_PASSWORD=yyy

# Storage (R2)
S3_ENDPOINT=https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
S3_ACCESS_KEY=${R2_ACCESS_KEY_ID}
S3_SECRET_KEY=${R2_SECRET_ACCESS_KEY}
S3_BUCKET_DATASETS=labeler-datasets
S3_BUCKET_ANNOTATIONS=labeler-annotations
S3_REGION=auto
S3_USE_SSL=true

# Auth
JWT_SECRET=${SHARED_SECRET_WITH_PLATFORM}

# App
ENVIRONMENT=production
LOG_LEVEL=info
```

#### 5.1.3 Deploy Backend
```bash
cd backend
railway up

# Check logs
railway logs

# Get deployment URL
railway status
# → https://mvp-vision-ai-labeler-backend.up.railway.app
```

### 5.2 Frontend Deployment (4-6h)

#### 5.2.1 Create railway.toml
Create `frontend/railway.toml`:
```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[env]
NODE_ENV = "production"
```

#### 5.2.2 Railway Environment Variables
Set in Railway dashboard:
```bash
# API URL
NEXT_PUBLIC_API_URL=https://mvp-vision-ai-labeler-backend.up.railway.app
```

#### 5.2.3 Deploy Frontend
```bash
cd frontend
railway up

# Check logs
railway logs

# Get deployment URL
railway status
# → https://mvp-vision-ai-labeler.up.railway.app
```

### 5.3 DNS & Domain Setup (1h)

#### 5.3.1 Configure Custom Domain (Optional)
Railway Dashboard → Settings → Domains:
- Backend: `api.labeler.yourdomain.com`
- Frontend: `labeler.yourdomain.com`

#### 5.3.2 Update CORS
Update `backend/app/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://labeler.yourdomain.com",
        "https://mvp-vision-ai-labeler.up.railway.app",
    ],
    # ...
)
```

### 5.4 Production Testing (2h)

#### 5.4.1 Health Check
```bash
curl https://mvp-vision-ai-labeler-backend.up.railway.app/health
```

#### 5.4.2 End-to-End Test
1. Login at https://mvp-vision-ai-labeler.up.railway.app
2. Load dataset
3. Create annotations
4. Confirm annotations
5. Export dataset
6. Verify all operations work

---

## Deployment Checklist

### Pre-Deployment
- [ ] Phase 1 완료 (User DB integration) ✅
- [ ] Phase 2 완료 (Labeler DB migration)
- [ ] Phase 3 완료 (S3 Internal → R2)
- [ ] Phase 4 완료 (S3 External → R2)
- [ ] Railway 계정 및 프로젝트 생성
- [ ] 모든 환경 변수 준비
- [ ] 로컬 데이터 백업

### During Deployment
- [ ] Maintenance 모드 활성화 (optional)
- [ ] 데이터베이스 마이그레이션 실행
- [ ] Storage 데이터 이전
- [ ] Backend 배포
- [ ] Frontend 배포
- [ ] DNS 설정 (if using custom domain)

### Post-Deployment
- [ ] Health check 통과
- [ ] 모든 엔드포인트 테스트
- [ ] 성능 벤치마크 (레이턴시 < 10% 증가)
- [ ] 로그 모니터링 (에러 없음)
- [ ] 사용자 테스트 (real workflow)
- [ ] 롤백 계획 확인

---

## Rollback Procedures

### Database Rollback
```bash
# 1. Stop Railway backend
railway down

# 2. Revert .env to local DB
cp .env.backup .env

# 3. Restore from backup (if needed)
pg_restore -h localhost -p 5435 -U labeler_user -d labeler \
  --clean labeler_backup_*.dump

# 4. Restart local backend
python -m uvicorn app.main:app --port 8011
```

### Storage Rollback
```bash
# 1. Revert .env to MinIO
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# 2. Ensure MinIO is running
docker-compose up -d minio

# 3. Restart backend
```

### Full Rollback
1. Database rollback (above)
2. Storage rollback (above)
3. Stop Railway deployments
4. Verify local services running
5. Test critical workflows

---

## Performance Targets

| Metric | Local | Railway Target | Notes |
|--------|-------|----------------|-------|
| API Latency | 50-100ms | 100-150ms | Network overhead |
| Image Load | 200-500ms | 300-700ms | CDN caching may improve |
| DB Query | 5-20ms | 20-50ms | Railway to Railway fast |
| Presigned URL | <10ms | <20ms | S3 API call |
| Throughput | 100 req/s | 80-100 req/s | Railway limits |

**Acceptable**: < 10% performance degradation
**Target**: ≤ 50ms latency increase for 95th percentile

---

## Cost Estimates

### Railway Costs
- **Hobby Plan**: $5/month per service
  - Backend: $5
  - Frontend: $5
  - PostgreSQL (Labeler DB): $5
  - **Total**: $15/month

- **Pro Plan**: $20/month (shared across services)
  - Higher resource limits
  - Better performance
  - Priority support

### Cloudflare R2 Costs
- **Storage**: $0.015/GB/month
  - 100GB: $1.50/month
  - 1TB: $15/month
- **Egress**: FREE (major advantage over S3)
- **Operations**:
  - Class A (write): $4.50 per million
  - Class B (read): $0.36 per million

### Total Monthly Estimate
- Railway (Hobby): $15
- R2 (100GB storage + operations): ~$2-5
- **Total**: ~$20-25/month

Compare to local:
- Electricity + hardware: variable
- Railway provides HA, backups, monitoring

---

## Security Checklist

### Database Security
- [x] Use strong passwords (Railway auto-generates)
- [x] Enable SSL/TLS connections
- [ ] Restrict IP access (Railway firewall)
- [ ] Enable connection pooling limits
- [ ] Monitor slow query logs

### Storage Security
- [x] Use separate R2 buckets (datasets, annotations)
- [x] Configure CORS restrictively
- [ ] Enable R2 bucket versioning (optional)
- [ ] Set up lifecycle policies (old exports cleanup)
- [ ] Monitor access logs

### Application Security
- [x] Use HTTPS only (Railway enforces)
- [x] Set secure CORS origins
- [x] Validate JWT tokens properly
- [ ] Enable rate limiting (Railway or app-level)
- [ ] Set up logging and monitoring
- [ ] Configure CSP headers (Next.js)

### Secrets Management
- [x] Store secrets in Railway env vars (not in code)
- [x] Use different secrets per environment (local, staging, prod)
- [ ] Rotate secrets periodically
- [ ] Audit access logs

---

## Monitoring & Logging

### Railway Monitoring
Built-in metrics:
- CPU usage
- Memory usage
- Network traffic
- Request count
- Error rate

Access via Railway dashboard → Metrics tab

### Application Logging
Use structured logging in Python:
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}'
)
```

Monitor logs:
```bash
railway logs --tail
```

### Alerts (Optional)
Set up alerts for:
- High error rate (>5%)
- High latency (>500ms p95)
- Database connection pool exhaustion
- Storage quota warnings

---

## Success Criteria

✅ **Deployment Complete** when:
1. User DB connection working (Platform → Railway)
2. Labeler DB migrated to Railway
3. All storage on Cloudflare R2
4. Backend deployed and healthy
5. Frontend deployed and accessible
6. All API endpoints responding (< 200ms p95)
7. Zero data loss
8. Zero downtime (or < 5 minutes)
9. Performance within targets (< 10% degradation)
10. All user workflows tested and working

---

## Next Steps After Deployment

1. **Monitor** first 24-48 hours closely
2. **Optimize** based on production metrics
3. **Scale** if needed (upgrade Railway plan)
4. **Backup** strategy (automated daily backups)
5. **CI/CD** setup (GitHub Actions → Railway)
6. **Staging** environment (separate Railway project)

---

## Additional Resources

- [Railway Docs](https://docs.railway.app/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Alembic Migrations](https://alembic.sqlalchemy.org/)
- [rclone Documentation](https://rclone.org/docs/)

---

**Status**: Ready for Phase 2 Implementation (Labeler DB Migration)
**Owner**: Labeler Team
**Last Updated**: 2025-11-25
