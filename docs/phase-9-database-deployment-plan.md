# Phase 9: Database Migration & Deployment (Railway)

**Date**: 2025-11-23
**Status**: 📋 Planning
**Context**: Microservices preparation - User DB separation from Platform DB

---

## Overview

이 Phase는 플랫폼의 마이크로서비스 전환 첫 단계로, User DB 분리에 맞춰 Labeler도 Railway로 데이터베이스를 이전하는 작업입니다.

### Background

플랫폼 팀에서 진행 중인 3단계 계획:
1. **로컬 SQLite에서 DB 분리 구현**
2. **Railway에 DB 배포 후 플랫폼 연결** ← 이 시점에 레이블러도 User DB 연결
3. **On-prem을 위한 K8s화**

### Labeler 대응 필요 사항

1. ✅ Railway의 User DB와 연결할 수 있도록 준비
2. ✅ Labeler DB도 Railway 배포

---

## Architecture Changes

### Current (AS-IS)

```
┌─────────────────────────────────────────┐
│ Labeler Backend                         │
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │ Platform DB  │    │ Labeler DB   │  │
│  │ (Read-Only)  │    │ (Full Access)│  │
│  │              │    │              │  │
│  │ - users      │    │ - datasets   │  │
│  │              │    │ - projects   │  │
│  │              │    │ - annotations│  │
│  └──────────────┘    └──────────────┘  │
│   localhost:5432      localhost:5433   │
└─────────────────────────────────────────┘
```

### Target (TO-BE)

```
┌─────────────────────────────────────────────────────┐
│ Labeler Backend                                     │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  User DB    │  │ Platform DB  │  │ Labeler DB│ │
│  │  (Railway)  │  │  (Railway)   │  │ (Railway) │ │
│  │             │  │              │  │           │ │
│  │ - users     │  │ - orgs       │  │ - datasets│ │
│  │ - profiles  │  │ - workspaces │  │ - projects│ │
│  │             │  │              │  │ - annot.. │ │
│  └─────────────┘  └──────────────┘  └───────────┘ │
│   railway.app      railway.app       railway.app  │
└─────────────────────────────────────────────────────┘
```

---

## Phase 9 Implementation Plan

**Total Estimate**: 22-28 hours (18-22h DB + 4-6h Storage optional)

### 9.1 User DB 연결 준비 (6-8h)

#### 9.1.1 Database Configuration (2h)
- [ ] 환경 변수 추가 (`USER_DB_*` 설정)
- [ ] `config.py`에 User DB URL 속성 추가
- [ ] `database.py`에 User DB 세션 팩토리 추가

**Files to Modify**:
- `backend/app/core/config.py`
- `backend/app/core/database.py`
- `backend/.env.example`

**Changes**:
```python
# config.py
class Settings(BaseSettings):
    # User Database (Separated from Platform)
    USER_DB_HOST: str = "localhost"
    USER_DB_PORT: int = 5434  # New port
    USER_DB_NAME: str = "users"
    USER_DB_USER: str = "user_readonly"
    USER_DB_PASSWORD: str = "..."

    @property
    def USER_DB_URL(self) -> str:
        return f"postgresql://{self.USER_DB_USER}:{self.USER_DB_PASSWORD}@{self.USER_DB_HOST}:{self.USER_DB_PORT}/{self.USER_DB_NAME}"
```

```python
# database.py
def get_user_db():
    """Get User database session (read-only)."""
    db = UserSessionLocal()
    try:
        yield db
    finally:
        db.close()
```

#### 9.1.2 Model Separation (2-3h)
- [ ] User 모델을 Platform에서 User DB로 이동
- [ ] Platform DB 모델 정리 (User 제거)
- [ ] Import 경로 업데이트

**Files to Modify**:
- `backend/app/db/models/platform.py` → 분리
- `backend/app/db/models/user.py` (NEW)
- All API endpoints importing User model

**Changes**:
```python
# Before (platform.py)
class User(PlatformBase):
    ...

# After (user.py - NEW FILE)
from app.db.base import UserBase

class User(UserBase):
    __tablename__ = "users"
    ...
```

#### 9.1.3 API Endpoint Updates (2-3h)
- [ ] 모든 `get_platform_db()` 호출 검토
- [ ] User 조회는 `get_user_db()`로 변경
- [ ] Platform 데이터 조회는 `get_platform_db()` 유지

**Files to Check**:
```bash
# Find all endpoints using User model
grep -r "from app.db.models.platform import User" backend/app/api/
grep -r "platform_db.query(User)" backend/app/api/
```

**Example Change**:
```python
# Before
async def get_annotation(
    platform_db: Session = Depends(get_platform_db),
):
    user = platform_db.query(User).filter(User.id == user_id).first()

# After
async def get_annotation(
    user_db: Session = Depends(get_user_db),
):
    user = user_db.query(User).filter(User.id == user_id).first()
```

---

### 9.2 Labeler DB Railway 배포 준비 (4-6h)

#### 9.2.1 Railway Project Setup (1h)
- [ ] Railway 프로젝트 생성
- [ ] PostgreSQL 플러그인 추가 (Labeler DB)
- [ ] 환경 변수 확인 (자동 생성됨)

**Railway Variables (auto-generated)**:
```
DATABASE_URL=postgresql://...
PGHOST=...
PGPORT=...
PGDATABASE=...
PGUSER=...
PGPASSWORD=...
```

#### 9.2.2 Database Schema Migration (2-3h)
- [ ] Alembic 마이그레이션 스크립트 검토
- [ ] Railway DB에 스키마 생성
- [ ] 인덱스 및 제약조건 확인

**Steps**:
```bash
# 1. Railway DB URL 설정
export LABELER_DB_URL="postgresql://..."

# 2. Alembic upgrade
cd backend
alembic upgrade head

# 3. 검증
psql $LABELER_DB_URL -c "\dt"  # List tables
```

#### 9.2.3 Data Migration Strategy (1-2h)
- [ ] 로컬 → Railway 데이터 이전 계획 수립
- [ ] 백업 스크립트 작성
- [ ] 복원 스크립트 작성

**Migration Script Outline**:
```bash
# backup_local.sh
pg_dump -h localhost -p 5433 -U labeler_user labeler > backup.sql

# restore_railway.sh
psql $RAILWAY_LABELER_DB_URL < backup.sql
```

---

### 9.3 환경 변수 및 설정 관리 (3-4h)

#### 9.3.1 Local Development (.env) (1h)
- [ ] `.env.example` 업데이트
- [ ] `.env.local` 템플릿 작성
- [ ] Railway 연결 설정 문서화

**Example `.env.local`**:
```bash
# Local Development - Railway DBs
USER_DB_HOST=containers-us-west-xxx.railway.app
USER_DB_PORT=5432
USER_DB_NAME=railway
USER_DB_USER=postgres
USER_DB_PASSWORD=xxx

LABELER_DB_HOST=containers-us-west-yyy.railway.app
LABELER_DB_PORT=5432
LABELER_DB_NAME=railway
LABELER_DB_USER=postgres
LABELER_DB_PASSWORD=yyy
```

#### 9.3.2 Railway Deployment Config (1-2h)
- [ ] `railway.toml` 설정 파일 작성
- [ ] 빌드 명령어 설정
- [ ] 환경 변수 매핑

**railway.toml** (NEW FILE):
```toml
[build]
builder = "NIXPACKS"
buildCommand = "pip install -r requirements.txt"

[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[env]
ENVIRONMENT = "production"
```

#### 9.3.3 Connection Pool Tuning (1h)
- [ ] Railway DB 연결 제한 확인
- [ ] SQLAlchemy pool 설정 최적화
- [ ] 타임아웃 설정

**config.py additions**:
```python
# Database Pool Settings (for Railway)
DB_POOL_SIZE: int = 5
DB_MAX_OVERFLOW: int = 10
DB_POOL_TIMEOUT: int = 30
DB_POOL_RECYCLE: int = 3600  # 1 hour
```

---

### 9.4 마이그레이션 실행 및 검증 (5-6h)

#### 9.4.1 Staging Environment Test (2-3h)
- [ ] Railway에 staging 환경 구축
- [ ] 테스트 데이터 이전
- [ ] API 엔드포인트 테스트
- [ ] 성능 벤치마크

**Test Checklist**:
- [ ] User 인증/조회 (User DB)
- [ ] Dataset CRUD (Labeler DB)
- [ ] Annotation CRUD (Labeler DB)
- [ ] Image lock 동작 (Labeler DB)
- [ ] ProjectPermission 동작 (Labeler DB)

#### 9.4.2 Production Migration (2h)
- [ ] 프로덕션 데이터 백업
- [ ] Railway DB로 이전
- [ ] DNS/환경변수 업데이트
- [ ] 서비스 재시작

**Migration Steps**:
1. Maintenance mode ON
2. Final backup
3. Restore to Railway
4. Update environment variables
5. Deploy backend with new config
6. Smoke test
7. Maintenance mode OFF

#### 9.4.3 Rollback Plan (1h)
- [ ] 롤백 스크립트 준비
- [ ] 로컬 DB 백업 유지
- [ ] 빠른 복구 절차 문서화

**Rollback Procedure**:
```bash
# 1. Revert environment variables
# 2. Restart with local DB config
# 3. Restore from backup if needed
```

---

### 9.5 Storage Migration (Optional - 4-6h)

**Context**: MinIO (localhost:9000) → Cloudflare R2 마이그레이션

#### 9.5.1 Storage Architecture Analysis (1h)
- [x] 현재 구조 분석 완료
- [x] DB-Storage 분리 확인
- [x] S3-Compatible API 검증

**핵심 발견**:
- ✅ DB에는 상대 경로만 저장 (`s3_key = "datasets/{id}/image.jpg"`)
- ✅ Presigned URL은 런타임에 동적 생성
- ✅ Cloudflare R2는 S3-Compatible API 제공
- ✅ 환경 변수 변경만으로 마이그레이션 가능

**Current Architecture**:
```python
# DB (image_metadata table)
s3_key = "datasets/ds_123/images/example.jpg"  # 상대 경로만
folder_path = "train/defect"
file_name = "example.jpg"

# Storage Client (runtime)
s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT,  # 환경 변수로 관리
    ...
)
url = s3_client.generate_presigned_url(...)  # 동적 생성
```

#### 9.5.2 Environment Configuration (1h)
- [ ] Cloudflare R2 계정 설정
- [ ] R2 버킷 생성 (datasets, annotations)
- [ ] 환경 변수 업데이트
- [ ] CORS 설정 (프론트엔드 직접 접근용)

**Environment Variables Change**:
```bash
# AS-IS (MinIO)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_DATASETS=datasets
S3_BUCKET_ANNOTATIONS=annotations
S3_REGION=us-east-1
S3_USE_SSL=False

# TO-BE (Cloudflare R2)
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY=<r2-access-key-id>
S3_SECRET_KEY=<r2-secret-access-key>
S3_BUCKET_DATASETS=datasets
S3_BUCKET_ANNOTATIONS=annotations
S3_REGION=auto  # R2 uses 'auto'
S3_USE_SSL=True
```

**R2 CORS Configuration**:
```json
{
  "AllowedOrigins": ["http://localhost:3010", "https://yourdomain.com"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3000
}
```

#### 9.5.3 Data Migration (2-3h)
- [ ] 데이터 이전 도구 선택 (rclone 권장)
- [ ] 버킷 구조 검증
- [ ] 데이터 복사 실행
- [ ] 무결성 검증

**Migration Tools**:

**Option 1: rclone (추천)**
```bash
# Install rclone
# Configure remotes

# Sync datasets bucket
rclone sync minio:datasets r2:datasets --progress

# Sync annotations bucket
rclone sync minio:annotations r2:annotations --progress

# Verify
rclone check minio:datasets r2:datasets
```

**Option 2: AWS CLI with S3 API**
```bash
# Copy datasets
aws s3 sync s3://datasets s3://datasets \
  --source-region us-east-1 \
  --endpoint-url http://localhost:9000 \
  --profile minio

# (then configure for R2 endpoint)
```

**Required Bucket Structure** (유지 필수):
```
datasets/
  ├── {dataset_id}/
  │   ├── images/
  │   │   ├── image1.jpg
  │   │   └── image2.jpg
  │   ├── thumbnails/
  │   │   ├── image1.jpg (256x256)
  │   │   └── image2.jpg (256x256)
  │   └── annotations_*.json
annotations/
  └── {project_id}/
      └── exports/
          └── coco_*.json
```

#### 9.5.4 Testing & Validation (1h)
- [ ] 이미지 로드 테스트 (Presigned URL)
- [ ] 썸네일 로드 테스트
- [ ] 이미지 업로드 테스트
- [ ] Annotation 저장/로드 테스트
- [ ] Export 기능 테스트

**Test Checklist**:
```bash
# 1. Image Load
GET /api/v1/projects/{id}/images
# → Check presigned URLs are valid

# 2. Thumbnail Load
GET /api/v1/datasets/{id}/summary
# → Check thumbnail URLs work

# 3. Upload
POST /api/v1/datasets/{id}/images
# → Upload test image

# 4. Annotation
POST /api/v1/annotations
# → Save to R2

# 5. Export
POST /api/v1/export
# → Generate and retrieve from R2
```

---

**⚠️ Critical Points**:

1. **버킷 구조 동일 유지**: MinIO와 R2에서 동일한 키 구조 사용
2. **Region 차이**: MinIO는 `us-east-1`, R2는 `auto`
3. **SSL/TLS**: MinIO는 HTTP, R2는 HTTPS
4. **CORS 필수**: 프론트엔드 직접 접근 시 CORS 설정 필요
5. **Zero Downtime**: DB 변경 없이 Storage만 교체 가능

**Migration Benefits**:
- ✅ **무료 송출**: Cloudflare R2는 egress 비용 없음
- ✅ **글로벌 CDN**: 자동 캐싱 및 배포
- ✅ **높은 가용성**: Cloudflare 인프라 활용
- ✅ **Zero DB Changes**: 환경 변수만 변경

**Optional (Phase 9.5 이후)**:
- [ ] R2 Custom Domain 설정
- [ ] Cache-Control 헤더 최적화
- [ ] MinIO 백업 서버로 활용

---

## Risk Assessment

### High Risk
- **데이터 유실**: 마이그레이션 중 데이터 손실 가능성
  - **완화**: 백업 + 검증 + 단계별 이전

- **다운타임**: 서비스 중단 시간
  - **완화**: Staging 테스트 + 신속한 마이그레이션

### Medium Risk
- **성능 저하**: Railway 네트워크 레이턴시
  - **완화**: 연결 풀 튜닝, 쿼리 최적화

- **환경 변수 관리**: 설정 누락/오류
  - **완화**: Checklist + 자동화 스크립트

### Low Risk
- **호환성 문제**: PostgreSQL 버전 차이
  - **완화**: 동일 버전 사용 (PostgreSQL 15)

---

## Success Criteria

✅ **Phase 9 완료 기준**:
1. User DB Railway 연결 성공 (읽기 전용)
2. Labeler DB Railway 배포 완료
3. 모든 API 엔드포인트 정상 작동
4. 성능 저하 < 10% (레이턴시)
5. 제로 데이터 유실
6. 문서화 완료 (설정 가이드, 마이그레이션 가이드)
7. **(Optional)** Storage 마이그레이션 완료 (MinIO → R2)

---

## Dependencies

### Prerequisites
- ✅ Phase 8.1 완료 (ProjectPermission 시스템)
- ✅ Railway 계정 및 프로젝트 접근 권한
- ✅ 플랫폼 팀의 User DB 분리 완료

### Blocks
- Phase 10 (AI Integration) - DB 연결 필요
- Phase 11 (Polish) - 프로덕션 환경 필요

---

## Documentation

### To Create
1. **Railway Setup Guide** (`docs/deployment/railway-setup.md`)
   - Railway 프로젝트 생성
   - DB 플러그인 설정
   - 환경 변수 구성

2. **Migration Guide** (`docs/deployment/database-migration.md`)
   - 로컬 → Railway 이전 절차
   - 백업/복원 스크립트
   - 롤백 절차

3. **Environment Variables Reference** (`docs/deployment/environment-variables.md`)
   - 모든 환경 변수 설명
   - 로컬/Staging/Production 설정 예제

---

## Timeline

**Total Duration**: 1-2 weeks (22-28 hours with Storage migration)

| Task | Duration | Depends On |
|------|----------|------------|
| **Database Migration** | | |
| 9.1.1 Database Config | 2h | - |
| 9.1.2 Model Separation | 2-3h | 9.1.1 |
| 9.1.3 API Updates | 2-3h | 9.1.2 |
| 9.2.1 Railway Setup | 1h | - |
| 9.2.2 Schema Migration | 2-3h | 9.2.1 |
| 9.2.3 Data Migration Plan | 1-2h | 9.2.2 |
| 9.3.1 Local .env | 1h | 9.1.1 |
| 9.3.2 Railway Config | 1-2h | 9.2.1 |
| 9.3.3 Pool Tuning | 1h | 9.3.2 |
| 9.4.1 Staging Test | 2-3h | 9.1-9.3 |
| 9.4.2 Production Migration | 2h | 9.4.1 |
| 9.4.3 Rollback Plan | 1h | - |
| **Storage Migration (Optional)** | | |
| 9.5.1 Architecture Analysis | 1h | - |
| 9.5.2 Environment Config | 1h | - |
| 9.5.3 Data Migration (MinIO→R2) | 2-3h | 9.5.2 |
| 9.5.4 Testing & Validation | 1h | 9.5.3 |

**Critical Path**:
- DB: 9.1 → 9.2 → 9.4.1 → 9.4.2
- Storage: 9.5.2 → 9.5.3 → 9.5.4 (병렬 진행 가능)

---

## Next Steps (After Phase 9)

1. **Phase 10**: AI Integration (requires stable production DB)
2. **Phase 11**: Polish & Optimization
3. **K8s Deployment** (Phase 12 - Future)

---

**Status**: 📋 Planning Complete - Ready for Implementation
**Owner**: TBD
**Reviewers**: Platform Team, DevOps Team
