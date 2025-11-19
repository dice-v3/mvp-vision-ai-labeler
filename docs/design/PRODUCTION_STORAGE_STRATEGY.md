# Production Storage Strategy

**작성일**: 2025-11-14
**상태**: Draft - Architecture Decision Required

---

## 1. 문제 정의

### 1.1 현재 상황 (Development)
```
┌────────────────────┐
│ Labeler Frontend   │
└─────────┬──────────┘
          │ presigned URL
          ↓
┌────────────────────┐
│ AWS S3             │ ← 직접 접근 (개발 편의)
│ - Dataset images   │
│ - Annotations      │
└────────────────────┘
```

**문제점**:
- ❌ S3 직접 접근 권한이 프로덕션에서는 불가능
- ❌ 보안 정책상 모든 S3 접근은 플랫폼 백엔드를 통해야 함
- ❌ 레이블러가 독자적으로 annotation export 파일을 S3에 저장 불가

### 1.2 제약사항
1. **S3 직접 접근 금지**: IAM 권한 없음
2. **플랫폼 의존성**: 이미지는 플랫폼 API를 통해서만 접근 가능
3. **독립성 필요**: 레이블러 시스템은 자체 데이터 관리 필요
4. **Export 요구사항**: COCO/YOLO 포맷 파일 생성 및 다운로드

---

## 2. Storage 전략 옵션 비교

### Option A: 플랫폼 백엔드 API 전적 의존

```
┌─────────────────────┐
│ Labeler Frontend    │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ Labeler Backend     │
│ - DB only           │
│ - No file storage   │
└──────────┬──────────┘
           │ API calls
           ↓
┌─────────────────────┐
│ Platform Backend    │
│ - S3 access         │
│ - Image serving     │
│ - Export files      │
└─────────────────────┘
```

**장점**:
- ✅ 중앙화된 storage 관리
- ✅ 일관된 보안 정책
- ✅ S3 비용 중복 없음
- ✅ 백업/복제 정책 통일

**단점**:
- ❌ 플랫폼 팀과의 긴밀한 협업 필요
- ❌ 플랫폼 API에 새 엔드포인트 추가 요청
- ❌ 레이블러 기능 추가 시 플랫폼 수정 필요
- ❌ 의존성 높음 (플랫폼 장애 시 레이블러도 장애)
- ❌ Export 속도가 플랫폼 서버 성능에 종속

**필요한 플랫폼 API**:
```
POST /api/v1/annotations/export
  - Request: project_id, format (coco/yolo), version
  - Response: S3 presigned download URL

GET /api/v1/annotations/versions/{versionId}/download
  - Response: presigned URL

POST /api/v1/storage/upload
  - Request: multipart file upload
  - Response: S3 path
```

---

### Option B: 레이블러 전용 Storage

```
┌─────────────────────┐
│ Labeler Frontend    │
└──────┬──────────────┘
       │
       ↓
┌─────────────────────┐
│ Labeler Backend     │
│ - PostgreSQL DB     │
│ - MinIO / S3        │ ← 레이블러 전용
│   (annotation only) │
└──────┬──────────────┘
       │ Image fetch only
       ↓
┌─────────────────────┐
│ Platform Backend    │
│ - S3 (images)       │
└─────────────────────┘
```

**장점**:
- ✅ 완전한 독립성
- ✅ 빠른 개발 및 기능 추가
- ✅ Export 성능 최적화 가능
- ✅ 레이블러만의 스토리지 정책

**단점**:
- ❌ Storage 비용 추가 (S3 or MinIO)
- ❌ 백업/복제 정책 별도 구축
- ❌ 인프라 관리 부담
- ❌ 데이터 중복 (플랫폼과 레이블러 각각 annotation 보관)

**기술 스택**:
- **클라우드**: AWS S3 (레이블러 전용 버킷)
- **On-premise**: MinIO (오픈소스 S3 호환 스토리지)

---

### Option C: Hybrid - DB Primary + On-demand Export

```
┌─────────────────────┐
│ Labeler Frontend    │
└──────┬──────────────┘
       │
       ↓
┌─────────────────────────────────────┐
│ Labeler Backend                      │
│ ┌──────────────┐  ┌───────────────┐│
│ │ PostgreSQL   │  │ Temp Storage  ││
│ │ (Primary)    │  │ (Export cache)││
│ └──────────────┘  └───────────────┘│
└──────┬──────────────────────────────┘
       │ Upload exported file
       ↓
┌─────────────────────┐
│ Platform Backend    │
│ - S3 storage        │
│ - File hosting      │
└─────────────────────┘
```

**동작 흐름**:
1. **일상 작업**: DB에만 저장 (빠름)
2. **Export 요청 시**:
   - DB → JSON 변환 (레이블러 백엔드)
   - Temp 파일 생성 (`/tmp/exports/`)
   - 플랫폼 API로 파일 업로드
   - 플랫폼이 S3에 저장 후 presigned URL 반환
   - Temp 파일 삭제

**장점**:
- ✅ 일상 작업은 빠름 (DB only)
- ✅ Storage 비용 절감 (임시 파일만)
- ✅ Export는 플랫폼 S3 활용
- ✅ 플랫폼과의 협업 최소화 (단순 파일 업로드 API만)

**단점**:
- ❌ Export 시 latency (DB → File → Upload)
- ❌ 대용량 export 시 임시 디스크 공간 필요
- ❌ 플랫폼 업로드 API 필요

---

### Option D: 플랫폼 Webhook + Async Export

```
┌─────────────────────┐
│ Labeler Frontend    │
└──────┬──────────────┘
       │
       ↓
┌─────────────────────┐
│ Labeler Backend     │
│ - PostgreSQL        │
│ - Message Queue     │
└──────┬──────────────┘
       │ Webhook: "Export ready"
       ↓
┌─────────────────────┐
│ Platform Backend    │
│ - Fetch annotations │
│ - Convert to COCO   │
│ - Save to S3        │
└─────────────────────┘
```

**동작 흐름**:
1. User: "Publish v1.0"
2. Labeler: DB에 version 생성, webhook 발송
3. Platform: `/api/v1/annotations?project_id=10` 호출 (레이블러 API)
4. Platform: COCO 변환 후 S3 저장
5. Platform: Callback으로 완료 알림

**장점**:
- ✅ 레이블러는 DB만 관리
- ✅ Export 로직이 플랫폼에 집중
- ✅ 비동기 처리 (사용자 대기 없음)

**단점**:
- ❌ 아키텍처 복잡도 증가
- ❌ Webhook 인증/보안 처리 필요
- ❌ 플랫폼과의 긴밀한 협업

---

## 3. 추천 전략: **Option C (Hybrid)**

### 3.1 이유

| 고려사항 | Option A | Option B | Option C | Option D |
|----------|----------|----------|----------|----------|
| 독립성 | ❌ 낮음 | ✅ 높음 | ✅ 중간 | ❌ 낮음 |
| 개발 속도 | ❌ 느림 | ✅ 빠름 | ✅ 빠름 | ❌ 느림 |
| Storage 비용 | ✅ 낮음 | ❌ 높음 | ✅ 낮음 | ✅ 낮음 |
| 플랫폼 의존 | ❌ 높음 | ✅ 낮음 | ✅ 중간 | ❌ 높음 |
| 확장성 | ✅ 좋음 | ✅ 좋음 | ✅ 좋음 | ✅ 좋음 |
| 구현 난이도 | 🟡 중간 | 🟡 중간 | 🟢 쉬움 | 🔴 어려움 |

**결론**: Option C가 **균형잡힌 선택**
- 일상 작업은 빠르고 독립적 (DB only)
- Export는 플랫폼 활용 (비용 절감)
- 플랫폼 API 요구사항 최소화 (단순 파일 업로드만)

---

## 4. Option C 상세 설계

### 4.1 Architecture

```
┌──────────────────────────────────────────────────┐
│ Labeler Frontend                                  │
│  - User clicks "Export COCO"                      │
└───────────────────────┬──────────────────────────┘
                        │
                        ↓
┌──────────────────────────────────────────────────┐
│ Labeler Backend                                   │
│  ┌────────────────────────────────────────────┐  │
│  │ 1. PostgreSQL Query                        │  │
│  │    SELECT * FROM annotations WHERE ...     │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ 2. Convert to COCO/YOLO                    │  │
│  │    annotations = build_coco_format(...)    │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ 3. Write to /tmp/exports/                  │  │
│  │    /tmp/exports/project-10-v1.0.json       │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ 4. Upload to Platform                      │  │
│  │    POST /api/v1/storage/upload             │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ 5. Get presigned URL                       │  │
│  │    s3_url = response['download_url']       │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ 6. Save URL to DB                          │  │
│  │    UPDATE annotation_versions              │  │
│  │    SET export_path = s3_url                │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ 7. Cleanup temp file                       │  │
│  │    rm /tmp/exports/project-10-v1.0.json    │  │
│  └────────────────────────────────────────────┘  │
└───────────────────────┬──────────────────────────┘
                        │
                        ↓
┌──────────────────────────────────────────────────┐
│ Platform Backend                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ POST /api/v1/storage/upload                │  │
│  │  - Receive file                            │  │
│  │  - Upload to S3                            │  │
│  │  - Return presigned download URL           │  │
│  └────────────────────────────────────────────┘  │
└───────────────────────┬──────────────────────────┘
                        │
                        ↓
┌──────────────────────────────────────────────────┐
│ AWS S3                                            │
│  s3://platform-storage/                          │
│    └── labeler-exports/                          │
│        └── project-10/                           │
│            ├── v1.0-annotations.json             │
│            └── v1.1-annotations.json             │
└──────────────────────────────────────────────────┘
```

### 4.2 필요한 플랫폼 API (최소)

#### **POST /api/v1/storage/upload**

레이블러가 파일을 플랫폼 S3에 업로드

**Request**:
```http
POST /api/v1/storage/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: annotations.json
folder: labeler-exports/project-10/
filename: v1.0-annotations.json
```

**Response**:
```json
{
  "success": true,
  "s3_path": "s3://platform-storage/labeler-exports/project-10/v1.0-annotations.json",
  "download_url": "https://platform-storage.s3.amazonaws.com/...",
  "expires_in": 3600
}
```

**플랫폼 구현** (예시):
```python
@app.post("/api/v1/storage/upload")
async def upload_file(
    file: UploadFile,
    folder: str,
    filename: str,
    current_user: User = Depends(get_current_user)
):
    # 1. Validate user permissions
    if not current_user.has_permission("storage.upload"):
        raise HTTPException(403)

    # 2. Sanitize path
    s3_key = f"{folder}/{filename}"

    # 3. Upload to S3
    s3_client.upload_fileobj(
        file.file,
        bucket="platform-storage",
        key=s3_key
    )

    # 4. Generate presigned URL (valid for 1 hour)
    download_url = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': 'platform-storage', 'Key': s3_key},
        ExpiresIn=3600
    )

    return {
        "success": True,
        "s3_path": f"s3://platform-storage/{s3_key}",
        "download_url": download_url,
        "expires_in": 3600
    }
```

**보안 고려사항**:
- ✅ File type validation (only .json, .txt, .zip)
- ✅ File size limit (max 100MB)
- ✅ Rate limiting (10 uploads per minute)
- ✅ Folder path 검증 (prefix must be `labeler-exports/`)

---

### 4.3 레이블러 백엔드 구현

#### **Service: AnnotationExportService**

```python
# backend/app/services/annotation_export.py

import json
import tempfile
import requests
from pathlib import Path
from typing import Literal

class AnnotationExportService:
    def __init__(self, db_session, platform_api_url: str, api_token: str):
        self.db = db_session
        self.platform_api = platform_api_url
        self.api_token = api_token

    async def export_and_upload(
        self,
        project_id: int,
        version_number: str,
        format: Literal['coco', 'yolo'] = 'coco'
    ) -> dict:
        """
        Export annotations and upload to platform S3

        Returns:
            {
                "version_id": 5,
                "download_url": "https://...",
                "file_size": 123456
            }
        """

        # 1. Fetch annotations from DB
        annotations = self.db.query(Annotation).filter(
            Annotation.project_id == project_id
        ).all()

        # 2. Convert to target format
        if format == 'coco':
            data = self._build_coco_format(annotations)
        elif format == 'yolo':
            data = self._build_yolo_format(annotations)

        # 3. Write to temporary file
        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.json',
            delete=False,
            dir='/tmp/exports'
        ) as f:
            json.dump(data, f, indent=2)
            temp_path = f.name

        try:
            # 4. Upload to platform
            upload_result = await self._upload_to_platform(
                file_path=temp_path,
                folder=f"labeler-exports/project-{project_id}",
                filename=f"{version_number}-annotations.json"
            )

            # 5. Save to DB
            version = AnnotationVersion(
                project_id=project_id,
                version_number=version_number,
                version_type='published',
                export_format=format,
                export_path=upload_result['s3_path'],
                download_url=upload_result['download_url']
            )
            self.db.add(version)
            self.db.commit()

            return {
                "version_id": version.id,
                "download_url": upload_result['download_url'],
                "file_size": Path(temp_path).stat().st_size
            }

        finally:
            # 6. Cleanup temp file
            Path(temp_path).unlink(missing_ok=True)

    async def _upload_to_platform(
        self,
        file_path: str,
        folder: str,
        filename: str
    ) -> dict:
        """Upload file to platform storage"""

        with open(file_path, 'rb') as f:
            files = {'file': (filename, f, 'application/json')}
            data = {
                'folder': folder,
                'filename': filename
            }
            headers = {
                'Authorization': f'Bearer {self.api_token}'
            }

            response = requests.post(
                f"{self.platform_api}/api/v1/storage/upload",
                files=files,
                data=data,
                headers=headers,
                timeout=300  # 5 min timeout
            )

            response.raise_for_status()
            return response.json()

    def _build_coco_format(self, annotations) -> dict:
        """Convert annotations to COCO format"""
        # ... existing logic
        pass
```

#### **API Endpoint**

```python
# backend/app/api/v1/endpoints/annotations.py

@router.post("/projects/{project_id}/annotations/export")
async def export_annotations(
    project_id: int,
    format: Literal['coco', 'yolo'] = 'coco',
    version_number: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export annotations and upload to platform S3
    """

    # Auto-generate version if not provided
    if not version_number:
        latest_version = db.query(AnnotationVersion).filter(
            AnnotationVersion.project_id == project_id,
            AnnotationVersion.version_type == 'published'
        ).order_by(AnnotationVersion.id.desc()).first()

        if latest_version:
            # Increment: v1.0 -> v1.1
            version_number = increment_version(latest_version.version_number)
        else:
            version_number = "v1.0"

    # Export
    export_service = AnnotationExportService(
        db_session=db,
        platform_api_url=settings.PLATFORM_API_URL,
        api_token=settings.PLATFORM_API_TOKEN
    )

    result = await export_service.export_and_upload(
        project_id=project_id,
        version_number=version_number,
        format=format
    )

    return {
        "success": True,
        "version_number": version_number,
        "version_id": result['version_id'],
        "download_url": result['download_url'],
        "file_size": result['file_size'],
        "format": format
    }
```

---

### 4.4 Temp Storage 관리

#### **Disk Space 문제 해결**

**시나리오**: 100개 프로젝트가 동시에 export 요청

**문제**:
```
/tmp/exports/
  ├── project-1-v1.0.json   (50MB)
  ├── project-2-v1.0.json   (120MB)
  ├── ...
  └── project-100-v1.0.json (80MB)

Total: ~8GB
```

**해결책**:

1. **파일 크기 제한**
```python
MAX_EXPORT_SIZE = 500 * 1024 * 1024  # 500MB

if file_size > MAX_EXPORT_SIZE:
    raise HTTPException(
        status_code=413,
        detail="Export too large. Please contact support."
    )
```

2. **Streaming Upload** (대용량 파일)
```python
def export_and_upload_streaming(self, project_id: int):
    """Stream export directly to platform without temp file"""

    # Generate COCO JSON line by line
    def generate_coco():
        yield '{"images": ['
        for i, image in enumerate(images):
            if i > 0:
                yield ','
            yield json.dumps(image)
        yield '], "annotations": ['
        # ...

    # Stream to platform
    response = requests.post(
        f"{self.platform_api}/api/v1/storage/upload-stream",
        data=generate_coco(),
        headers={'Content-Type': 'application/json'}
    )
```

3. **자동 정리** (Cron job)
```bash
# Cleanup temp files older than 1 hour
0 * * * * find /tmp/exports/ -type f -mmin +60 -delete
```

4. **별도 볼륨**
```yaml
# docker-compose.yml
volumes:
  - /mnt/exports:/tmp/exports  # 전용 볼륨 (100GB)
```

---

### 4.5 DB Schema 수정

```sql
ALTER TABLE annotation_versions ADD COLUMN download_url TEXT;
ALTER TABLE annotation_versions ADD COLUMN file_size BIGINT;
ALTER TABLE annotation_versions ADD COLUMN expires_at TIMESTAMP;

-- Presigned URL은 1시간 후 만료되므로 재생성 필요
CREATE INDEX idx_version_expires ON annotation_versions(expires_at);
```

**URL 재생성 로직**:
```python
@router.get("/versions/{version_id}/download")
async def get_version_download_url(version_id: int, db: Session = Depends(get_db)):
    version = db.query(AnnotationVersion).filter(
        AnnotationVersion.id == version_id
    ).first()

    # Check if URL expired
    if version.expires_at < datetime.now():
        # Request new presigned URL from platform
        response = requests.post(
            f"{PLATFORM_API}/api/v1/storage/presigned-url",
            json={"s3_path": version.export_path}
        )

        new_url = response.json()['download_url']

        # Update DB
        version.download_url = new_url
        version.expires_at = datetime.now() + timedelta(hours=1)
        db.commit()

    return {"download_url": version.download_url}
```

---

## 5. 플랫폼 팀 협의 사항

### 5.1 필요한 API (우선순위 순)

| Priority | Endpoint | Purpose | ETA |
|----------|----------|---------|-----|
| **P0** | `POST /api/v1/storage/upload` | File upload to S3 | Week 2 |
| **P1** | `POST /api/v1/storage/presigned-url` | Re-generate URL | Week 3 |
| **P2** | `DELETE /api/v1/storage/file` | Delete old versions | Week 4 |

### 5.2 S3 Bucket 구조 협의

```
s3://platform-storage/
  ├── datasets/              # 플랫폼 관리
  │   └── project-10/
  │       └── images/
  │
  └── labeler-exports/       # 레이블러 관리
      └── project-10/
          ├── v1.0-annotations.json
          ├── v1.1-annotations.json
          └── v2.0-annotations.json
```

**Bucket Policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::xxx:role/labeler-backend"},
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::platform-storage/labeler-exports/*"
    }
  ]
}
```

### 5.3 Rate Limiting

| API | Limit |
|-----|-------|
| Upload | 10 requests/min per user |
| Presigned URL | 100 requests/min per user |

---

## 6. 대안: MinIO (Self-hosted)

만약 플랫폼 팀 협업이 어렵다면, **MinIO** 고려

### 6.1 MinIO 개요

**MinIO**: 오픈소스 S3 호환 object storage

```
┌─────────────────┐
│ Labeler Backend │
└────────┬────────┘
         │ S3 API
         ↓
┌─────────────────┐
│ MinIO Server    │ ← Self-hosted
│ - Docker        │
│ - 100GB volume  │
└─────────────────┘
```

### 6.2 장점
- ✅ S3 API 호환 (코드 변경 최소)
- ✅ 플랫폼 독립적
- ✅ 무료 (오픈소스)
- ✅ 빠른 로컬 접근

### 6.3 단점
- ❌ 인프라 관리 부담
- ❌ 백업/복제 직접 구축
- ❌ 확장성 제한 (단일 서버)

### 6.4 Docker Compose

```yaml
# docker-compose.yml
services:
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: password
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

  labeler-backend:
    environment:
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: admin
      S3_SECRET_KEY: password
      S3_BUCKET: labeler-exports

volumes:
  minio_data:
    driver: local
```

---

## 7. 최종 추천

### Phase 1 (MVP): **MinIO**
- 빠른 개발
- 플랫폼 의존성 없음
- 검증 및 테스트

### Phase 2 (Production): **Hybrid (Option C)**
- 플랫폼 API 협의 완료 후
- S3 활용으로 비용 절감
- 장기적 확장성

---

## 8. 다음 단계

1. **플랫폼 팀과 협의** (이번 주)
   - `POST /api/v1/storage/upload` API 가능 여부
   - S3 bucket 구조 합의
   - ETA 확인

2. **임시 해결책** (Phase 1)
   - MinIO 구축 (2일)
   - Export 기능 구현 (3일)

3. **마이그레이션 준비** (Phase 2)
   - 플랫폼 API 완료 시
   - MinIO → S3 데이터 이관
   - 코드 수정 (endpoint만 변경)

---

**Status**: 🟡 Draft - Platform Team Review Required
**Decision Needed By**: 2025-11-17
**Fallback Plan**: MinIO (self-hosted)
