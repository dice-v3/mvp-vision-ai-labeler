# Platform API Requirements for Labeler Integration

## Overview
Labeler 서비스가 Platform과 통합하기 위해 필요한 REST API 명세입니다.
Platform은 아래 API를 제공하여 Labeler가 독립적으로 동작할 수 있도록 해야 합니다.

## Architecture
- **인증**: JWT 기반 (Labeler는 Platform의 JWT를 사용)
- **통신**: REST API over HTTP
- **데이터 포맷**: JSON
- **Base URL**: `http://localhost:8000/api/v1` (개발환경)

---

## 1. Authentication APIs

### 1.1 Get Current User
현재 로그인한 사용자 정보를 조회합니다.

**Endpoint**: `GET /api/v1/auth/me`

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Response** (200 OK):
```json
{
  "id": 1,
  "email": "admin@example.com",
  "full_name": "Admin User",
  "company": "Example Corp",
  "division": "Engineering",
  "department": "AI Lab",
  "system_role": "admin",
  "is_active": true,
  "badge_color": "indigo",
  "created_at": "2025-11-13T01:58:33.665008",
  "updated_at": "2025-11-13T03:52:45.786541"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or expired JWT token
- `403 Forbidden`: Inactive user

---

## 2. Dataset APIs

### 2.1 List Datasets
사용자가 접근 가능한 데이터셋 목록을 조회합니다.

**Endpoint**: `GET /api/v1/datasets`

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| skip | integer | No | 0 | Pagination offset |
| limit | integer | No | 100 | Maximum results (max: 100) |
| visibility | string | No | all | Filter by visibility: `public`, `private`, `all` |
| labeled | boolean | No | - | Filter by labeled status |

**Response** (200 OK):
```json
{
  "items": [
    {
      "id": "468cc408-d9cf-47bc-9a0a-d9aaf63b4f35",
      "name": "sample-det-coco32",
      "description": "Dataset: sample-det-coco32",
      "owner_id": 1,
      "owner": {
        "id": 1,
        "full_name": "Admin User",
        "email": "admin@example.com",
        "badge_color": "indigo"
      },
      "format": "dice",
      "storage_type": "minio",
      "visibility": "public",
      "labeled": true,
      "num_images": 32,
      "num_classes": 80,
      "class_names": ["person", "car", "dog", "..."],
      "storage_path": "datasets/468cc408-d9cf-47bc-9a0a-d9aaf63b4f35/",
      "status": "ready",
      "integrity_status": "verified",
      "created_at": "2025-11-13T01:58:33.665008",
      "updated_at": "2025-11-13T03:52:45.786541"
    }
  ],
  "total": 1,
  "skip": 0,
  "limit": 100
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or expired JWT token
- `400 Bad Request`: Invalid query parameters

---

### 2.2 Get Dataset Details
특정 데이터셋의 상세 정보를 조회합니다.

**Endpoint**: `GET /api/v1/datasets/{dataset_id}`

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| dataset_id | string | Yes | Dataset UUID |

**Response** (200 OK):
```json
{
  "id": "468cc408-d9cf-47bc-9a0a-d9aaf63b4f35",
  "name": "sample-det-coco32",
  "description": "Dataset: sample-det-coco32",
  "owner_id": 1,
  "owner": {
    "id": 1,
    "full_name": "Admin User",
    "email": "admin@example.com",
    "badge_color": "indigo"
  },
  "format": "dice",
  "storage_type": "minio",
  "visibility": "public",
  "labeled": true,
  "num_images": 32,
  "num_classes": 80,
  "class_names": ["person", "car", "dog", "..."],
  "storage_path": "datasets/468cc408-d9cf-47bc-9a0a-d9aaf63b4f35/",
  "annotation_path": "datasets/468cc408-d9cf-47bc-9a0a-d9aaf63b4f35/annotations.json",
  "status": "ready",
  "integrity_status": "verified",
  "version": 1,
  "is_snapshot": false,
  "split_config": {
    "train": 0.8,
    "val": 0.1,
    "test": 0.1
  },
  "created_at": "2025-11-13T01:58:33.665008",
  "updated_at": "2025-11-13T03:52:45.786541"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or expired JWT token
- `403 Forbidden`: No permission to access dataset
- `404 Not Found`: Dataset does not exist

---

### 2.3 List Dataset Images
데이터셋의 이미지 목록을 조회합니다 (presigned URLs 포함).

**Endpoint**: `GET /api/v1/datasets/{dataset_id}/images`

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| dataset_id | string | Yes | Dataset UUID |

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | integer | No | 1000 | Maximum results (max: 1000) |
| offset | integer | No | 0 | Pagination offset |
| prefix | string | No | images/ | S3 prefix filter |

**Response** (200 OK):
```json
{
  "dataset_id": "468cc408-d9cf-47bc-9a0a-d9aaf63b4f35",
  "images": [
    {
      "key": "datasets/468cc408-d9cf-47bc-9a0a-d9aaf63b4f35/images/000000000139.jpg",
      "filename": "000000000139.jpg",
      "size": 142845,
      "last_modified": "2025-11-13T01:58:35.123456",
      "url": "http://localhost:9000/training-datasets/datasets/468cc408-d9cf-47bc-9a0a-d9aaf63b4f35/images/000000000139.jpg?X-Amz-Algorithm=...",
      "width": 640,
      "height": 480
    },
    {
      "key": "datasets/468cc408-d9cf-47bc-9a0a-d9aaf63b4f35/images/000000000285.jpg",
      "filename": "000000000285.jpg",
      "size": 98234,
      "last_modified": "2025-11-13T01:58:35.234567",
      "url": "http://localhost:9000/training-datasets/datasets/468cc408-d9cf-47bc-9a0a-d9aaf63b4f35/images/000000000285.jpg?X-Amz-Algorithm=...",
      "width": 800,
      "height": 600
    }
  ],
  "total": 32,
  "offset": 0,
  "limit": 1000
}
```

**Notes**:
- Presigned URLs는 1시간 유효
- `width`와 `height`는 optional (메타데이터가 있는 경우에만)

**Error Responses**:
- `401 Unauthorized`: Invalid or expired JWT token
- `403 Forbidden`: No permission to access dataset
- `404 Not Found`: Dataset does not exist

---

## 3. Storage APIs

### 3.1 Generate Presigned URL
특정 S3 객체에 대한 presigned URL을 생성합니다.

**Endpoint**: `POST /api/v1/storage/presigned-url`

**Headers**:
```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "bucket": "training-datasets",
  "key": "datasets/468cc408-d9cf-47bc-9a0a-d9aaf63b4f35/images/test.jpg",
  "expiration": 3600,
  "method": "GET"
}
```

**Parameters**:
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| bucket | string | Yes | - | S3 bucket name |
| key | string | Yes | - | S3 object key |
| expiration | integer | No | 3600 | URL expiration in seconds (max: 86400) |
| method | string | No | GET | HTTP method: GET, PUT, DELETE |

**Response** (200 OK):
```json
{
  "url": "http://localhost:9000/training-datasets/datasets/468cc408-d9cf-47bc-9a0a-d9aaf63b4f35/images/test.jpg?X-Amz-Algorithm=...",
  "expires_at": "2025-11-13T05:00:00.000000",
  "method": "GET"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or expired JWT token
- `403 Forbidden`: No permission to access object
- `400 Bad Request`: Invalid parameters

---

## 4. User APIs

### 4.1 Get User by ID
특정 사용자의 정보를 조회합니다.

**Endpoint**: `GET /api/v1/users/{user_id}`

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | integer | Yes | User ID |

**Response** (200 OK):
```json
{
  "id": 1,
  "email": "admin@example.com",
  "full_name": "Admin User",
  "company": "Example Corp",
  "division": "Engineering",
  "department": "AI Lab",
  "system_role": "admin",
  "is_active": true,
  "badge_color": "indigo",
  "created_at": "2025-11-13T01:58:33.665008",
  "updated_at": "2025-11-13T03:52:45.786541"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or expired JWT token
- `403 Forbidden`: No permission to view user
- `404 Not Found`: User does not exist

---

## Implementation Notes

### Security
1. **모든 API는 JWT 인증 필수**
2. **CORS 설정 필요**: Labeler frontend (localhost:3001) 허용
3. **Rate Limiting**: 악의적인 요청 방지
4. **Permission 체크**:
   - Dataset visibility에 따른 접근 제어
   - Owner/Admin만 private dataset 접근 가능

### Performance
1. **Presigned URLs**:
   - 1시간 캐싱 권장
   - Batch generation 지원 고려
2. **Pagination**:
   - 큰 데이터셋 처리를 위한 cursor-based pagination 고려
3. **Response Caching**:
   - Dataset 메타데이터는 Redis 캐싱 권장

### Error Handling
모든 에러 응답은 다음 포맷을 따릅니다:

```json
{
  "detail": "Error message",
  "error_code": "DATASET_NOT_FOUND",
  "timestamp": "2025-11-13T03:52:45.786541"
}
```

### API Versioning
- URL 기반 versioning: `/api/v1/...`
- Breaking changes시 v2 도입

---

## Migration Plan

### Phase 1: API 구현 (Platform)
1. 위 명세에 따라 Platform에 API 구현
2. 기존 Platform frontend도 이 API 사용하도록 리팩토링 권장
3. Integration tests 작성

### Phase 2: Labeler 수정
1. Platform DB 직접 접근 제거
2. API client 구현
3. API 호출로 변경

### Phase 3: 배포
1. Platform API 먼저 배포
2. Labeler 배포
3. DB 직접 연결 제거

---

## Questions for Platform Team

1. **Authentication**:
   - JWT secret은 공유 가능한가? (동일한 secret 사용시)
   - 아니면 JWT validation endpoint 필요한가?

2. **Rate Limiting**:
   - API rate limit 정책이 있나요?
   - Labeler는 어느 정도의 QPS를 예상해야 하나요?

3. **Monitoring**:
   - API 사용량/에러 모니터링 방법은?
   - Health check endpoint는?

4. **Storage**:
   - MinIO credentials는 어떻게 공유하나요?
   - Presigned URL 생성을 Platform에서 하는게 맞나요, 아니면 Labeler가 직접?

5. **Future APIs**:
   - Dataset 생성/수정 API도 필요한가요? (현재는 read-only)
   - Training job 연동 API는?
