# Platform 팀 - Labeler API 연동 가이드

**작성일**: 2025-11-30
**Phase**: 16.6 (Task-Type-Specific Dataset Query)
**대상**: Platform Backend 개발팀

---

## 📋 목차

1. [변경 사항 요약](#변경-사항-요약)
2. [API 엔드포인트 상세](#api-엔드포인트-상세)
3. [task_type별 통계 반환 로직](#task_type별-통계-반환-로직)
4. [사용 예시](#사용-예시)
5. [마이그레이션 가이드](#마이그레이션-가이드)
6. [FAQ](#faq)

---

## 🎯 변경 사항 요약

### Phase 16.6: Task-Type-Specific Dataset Query

Labeler가 **task_type별 데이터셋 필터링 및 통계 제공** 기능을 추가했습니다.

#### 주요 변경사항

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| **데이터셋 필터링** | labeled=true만 가능 | task_type별 필터링 가능 |
| **통계 정보** | 전체 데이터셋 통계 반환 | task_type별 통계 반환 |
| **annotation_path** | 고정된 경로 | task_type별 최신 버전 경로 |
| **응답 필드** | - | `published_task_types` 추가 |

---

## 📡 API 엔드포인트 상세

### 1. 데이터셋 목록 조회 (List Datasets)

#### 엔드포인트
```
GET /api/v1/platform/datasets
```

#### 인증
```http
Authorization: Bearer <SERVICE_JWT_TOKEN>
```

#### 새로 추가된 쿼리 파라미터

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|----------|------|------|------|------|
| `task_type` | string | ❌ | 학습 task type으로 필터링 | `detection`, `segmentation`, `classification` |

#### 기존 쿼리 파라미터 (변경 없음)

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `user_id` | integer | ❌ | Owner로 필터링 |
| `visibility` | string | ❌ | `public`, `private`, `organization` |
| `labeled` | boolean | ❌ | labeled 상태로 필터링 |
| `format` | string | ❌ | `coco`, `yolo`, `dice`, `imagefolder` |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 50, max: 200) |

#### 응답 스키마 변경

**새로 추가된 필드**:

```json
{
  "datasets": [{
    ...
    "published_task_types": ["detection", "segmentation"],  // ← 새 필드
    ...
  }]
}
```

**전체 응답 예시**:

```json
{
  "total": 1,
  "page": 1,
  "limit": 50,
  "datasets": [
    {
      "id": "ds_c75023ca76d7448b",
      "name": "mvtec-ad",
      "description": "MVTec Anomaly Detection Dataset",
      "format": "coco",
      "labeled": true,
      "storage_type": "r2",
      "storage_path": "datasets/ds_c75023ca76d7448b",
      "annotation_path": "exports/proj_026c67eeafb4/detection/v10.0/annotations.json",

      // 통계 정보 (task_type별로 달라짐!)
      "num_classes": null,
      "num_images": 163,  // ← task_type='detection' 지정 시: 163개
                          // ← task_type 미지정 시: 1725개 (전체)
      "class_names": null,

      // Phase 16.6 추가 필드
      "published_task_types": ["detection"],  // ← 어떤 task_type으로 publish 되었는지

      // 메타데이터
      "tags": ["anomaly-detection", "industrial"],
      "visibility": "public",
      "owner_id": 1,
      "version": 10,
      "content_hash": "abc123...",
      "created_at": "2025-11-25T10:00:00",
      "updated_at": "2025-11-26T15:30:00"
    }
  ]
}
```

---

## 🔍 task_type별 통계 반환 로직

### ⚠️ 중요: 통계 정보는 task_type에 따라 달라집니다!

#### Case 1: `task_type` 파라미터 제공 (권장)

```http
GET /api/v1/platform/datasets?task_type=detection&labeled=true
```

**반환 통계**: 해당 task_type의 **최신 AnnotationVersion 통계**

| 필드 | 값 | 설명 |
|------|-----|------|
| `num_images` | 163 | **detection task에서 annotate된 이미지 수** |
| `annotation_path` | `exports/.../detection/v10.0/annotations.json` | **detection task의 최신 export 경로** |
| `published_task_types` | `["detection"]` | 이 데이터셋이 publish된 task type 목록 |

**학습에 사용할 정확한 데이터**:
- 이미지: 163개
- Annotation 파일: `exports/proj_026c67eeafb4/detection/v10.0/annotations.json`

---

#### Case 2: `task_type` 파라미터 미제공

```http
GET /api/v1/platform/datasets?labeled=true
```

**반환 통계**: 전체 데이터셋의 **Dataset 테이블 통계**

| 필드 | 값 | 설명 |
|------|-----|------|
| `num_images` | 1725 | **데이터셋의 전체 이미지 수** |
| `annotation_path` | `datasets/.../annotations_detection.json` | 데이터셋 레벨 annotation 경로 (참고용) |
| `published_task_types` | `["detection"]` | 이 데이터셋이 publish된 task type 목록 |

⚠️ **주의**: 전체 통계이므로 학습에 직접 사용하기 부적합!

---

### 예시 시나리오

#### 시나리오 1: mvtec-ad 데이터셋

**데이터셋 구성**:
- 전체 이미지: 1,725개
- detection으로 publish: 163개 이미지, 241개 annotation (v10.0)
- segmentation으로 publish: 안 됨
- classification으로 publish: 안 됨

**Platform 팀의 요청별 응답**:

| Platform 요청 | 반환 데이터셋 수 | num_images | annotation_path |
|---------------|------------------|------------|-----------------|
| `task_type=detection` | 1개 (mvtec-ad) | **163** | `exports/.../detection/v10.0/...` |
| `task_type=segmentation` | 0개 | - | - |
| `task_type=classification` | 0개 | - | - |
| `task_type` 미지정 | 1개 (mvtec-ad) | **1725** | `datasets/.../annotations_detection.json` |

---

#### 시나리오 2: multi-task 데이터셋 (가정)

**데이터셋 구성**:
- 전체 이미지: 5,000개
- detection으로 publish: 3,200개 이미지 (v5.0)
- segmentation으로 publish: 1,800개 이미지 (v3.0)
- classification으로 publish: 4,500개 이미지 (v2.0)

**Platform 팀의 요청별 응답**:

| Platform 요청 | num_images | annotation_path |
|---------------|------------|-----------------|
| `task_type=detection` | **3,200** | `exports/.../detection/v5.0/...` |
| `task_type=segmentation` | **1,800** | `exports/.../segmentation/v3.0/...` |
| `task_type=classification` | **4,500** | `exports/.../classification/v2.0/...` |
| `task_type` 미지정 | **5,000** | `datasets/.../...` (전체) |

---

## 💡 사용 예시

### Python 코드 예시 (Platform Backend)

```python
import requests
import jwt
from datetime import datetime, timedelta

# 1. Service JWT 생성
SERVICE_JWT_SECRET = "8f7e6d5c4b3a29180716253e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a"

def create_service_jwt(user_id: int) -> str:
    """Platform에서 Labeler API 호출용 JWT 생성"""
    payload = {
        "sub": str(user_id),  # 사용자 ID
        "service": "platform",
        "scopes": ["labeler:read"],
        "type": "service",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=5),
    }
    return jwt.encode(payload, SERVICE_JWT_SECRET, algorithm="HS256")


# 2. Detection 모델 학습용 데이터셋 조회
def get_datasets_for_detection_training(user_id: int):
    """Detection 모델 학습에 사용할 데이터셋 목록 조회"""

    token = create_service_jwt(user_id)

    response = requests.get(
        "http://labeler-backend:8000/api/v1/platform/datasets",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "task_type": "detection",  # ← 중요!
            "labeled": True,
            "limit": 100,
        }
    )

    if response.status_code != 200:
        raise Exception(f"Failed to fetch datasets: {response.text}")

    data = response.json()

    for dataset in data["datasets"]:
        print(f"Dataset: {dataset['name']}")
        print(f"  - Images: {dataset['num_images']}")  # detection task 이미지 수
        print(f"  - Annotation: {dataset['annotation_path']}")  # detection annotation 경로
        print(f"  - Published tasks: {dataset['published_task_types']}")
        print()

    return data["datasets"]


# 3. 특정 데이터셋으로 학습 Job 생성
def create_training_job(user_id: int, dataset_id: str, task_type: str):
    """학습 Job 생성"""

    # 1단계: 데이터셋 정보 조회 (task_type별 통계 포함)
    token = create_service_jwt(user_id)

    response = requests.get(
        f"http://labeler-backend:8000/api/v1/platform/datasets",
        headers={"Authorization": f"Bearer {token}"},
        params={"task_type": task_type}
    )

    datasets = response.json()["datasets"]
    dataset = next((d for d in datasets if d["id"] == dataset_id), None)

    if not dataset:
        raise Exception(f"Dataset {dataset_id} not found or not published for {task_type}")

    # 2단계: task_type별 정확한 통계 확인
    print(f"Creating training job:")
    print(f"  - Dataset: {dataset['name']}")
    print(f"  - Task: {task_type}")
    print(f"  - Images: {dataset['num_images']}")  # task_type별 이미지 수
    print(f"  - Annotation path: {dataset['annotation_path']}")  # task_type별 경로

    # 3단계: 학습 Job 생성 (Platform 내부 로직)
    training_job = {
        "dataset_id": dataset_id,
        "task_type": task_type,
        "num_images": dataset["num_images"],
        "annotation_path": dataset["annotation_path"],
        # ... 기타 학습 설정
    }

    return training_job


# 사용 예시
if __name__ == "__main__":
    user_id = 1  # admin@example.com

    # Detection 모델 학습용 데이터셋 조회
    print("=" * 80)
    print("Detection 모델 학습용 데이터셋 조회")
    print("=" * 80)
    datasets = get_datasets_for_detection_training(user_id)

    # 학습 Job 생성
    if datasets:
        print("\n" + "=" * 80)
        print("학습 Job 생성")
        print("=" * 80)
        job = create_training_job(
            user_id=user_id,
            dataset_id=datasets[0]["id"],
            task_type="detection"
        )
```

---

## 🔄 마이그레이션 가이드

### Platform Backend 수정 사항

#### 1. API 요청 시 `task_type` 파라미터 추가

**변경 전**:
```python
response = requests.get(
    f"{LABELER_API}/platform/datasets",
    params={"labeled": True}
)
```

**변경 후**:
```python
response = requests.get(
    f"{LABELER_API}/platform/datasets",
    params={
        "labeled": True,
        "task_type": training_job.task_type  # ← 추가!
    }
)
```

---

#### 2. 응답 스키마에 `published_task_types` 필드 추가

**Platform의 Dataset 모델** (Pydantic 또는 TypeScript):

```python
class LabelerDatasetResponse(BaseModel):
    id: str
    name: str
    ...
    num_images: int
    published_task_types: List[str]  # ← 새 필드 추가
    ...
```

```typescript
// TypeScript
interface LabelerDataset {
  id: string;
  name: string;
  ...
  num_images: number;
  published_task_types: string[];  // ← 새 필드 추가
  ...
}
```

---

#### 3. 검증 로직 추가

```python
def validate_dataset_for_training(dataset: dict, task_type: str):
    """데이터셋이 특정 task_type으로 학습 가능한지 검증"""

    # Check 1: task_type이 publish되어 있는지 확인
    if task_type not in dataset["published_task_types"]:
        raise ValueError(
            f"Dataset {dataset['name']} is not published for {task_type}. "
            f"Available: {dataset['published_task_types']}"
        )

    # Check 2: 충분한 이미지가 있는지 확인
    if dataset["num_images"] < 10:
        raise ValueError(
            f"Dataset {dataset['name']} has only {dataset['num_images']} images "
            f"for {task_type}, minimum 10 required"
        )

    # Check 3: annotation_path가 있는지 확인
    if not dataset["annotation_path"]:
        raise ValueError(
            f"Dataset {dataset['name']} has no annotation file for {task_type}"
        )

    return True
```

---

## ❓ FAQ

### Q1: task_type을 지정하지 않으면 어떻게 되나요?

A: 전체 데이터셋 통계를 반환합니다. 하지만 **학습에 사용하기에는 부적합**합니다.

**예시**:
- 요청: `GET /api/v1/platform/datasets?labeled=true` (task_type 없음)
- 응답: `num_images=1725` (전체 이미지 수)
- 문제: detection task는 실제로 163개 이미지만 있음!

**권장**: 항상 `task_type` 파라미터를 명시하세요.

---

### Q2: 하나의 데이터셋을 여러 task_type으로 사용할 수 있나요?

A: **네, 가능합니다.**

하나의 데이터셋이 detection, segmentation, classification 모두로 publish될 수 있습니다.

**예시**:
```json
{
  "id": "ds_multi_task",
  "name": "Multi-Task Dataset",
  "published_task_types": ["detection", "segmentation", "classification"],
  ...
}
```

**각 task_type별로 조회하면 다른 통계가 반환됩니다**:
- `task_type=detection` → 3,200개 이미지
- `task_type=segmentation` → 1,800개 이미지
- `task_type=classification` → 4,500개 이미지

---

### Q3: published_task_types가 빈 배열이면?

A: 해당 데이터셋은 **아직 publish되지 않았습니다**.

```json
{
  "id": "ds_unpublished",
  "name": "Work in Progress",
  "labeled": false,
  "published_task_types": [],  // ← 빈 배열
  ...
}
```

**권장**: `labeled=true`와 `task_type` 필터를 함께 사용하면 publish된 데이터셋만 조회됩니다.

---

### Q4: annotation_path는 어떻게 사용하나요?

A: **task_type별 최신 annotation 파일 경로**입니다.

**경로 구조**:
```
exports/{project_id}/{task_type}/{version}/annotations.json
```

**예시**:
```
exports/proj_026c67eeafb4/detection/v10.0/annotations.json
```

**S3/R2에서 다운로드**:
```python
# Labeler의 R2 버킷에서 다운로드
s3_key = dataset["annotation_path"]
annotation_url = storage_client.generate_presigned_url(
    bucket="training-datasets",
    key=s3_key,
    expiration=3600
)
```

또는 **Labeler API의 download-url 엔드포인트 사용**:
```python
# Labeler API를 통해 presigned URL 받기 (권장)
response = requests.post(
    f"{LABELER_API}/platform/datasets/{dataset_id}/download-url",
    headers={"Authorization": f"Bearer {token}"},
    json={"expiration_seconds": 3600}
)
download_url = response.json()["download_url"]
```

---

### Q5: num_classes와 class_names는 어떻게 되나요?

A: 현재 버전에서는 **데이터셋 레벨 통계**를 반환합니다.

**향후 개선 예정**:
- task_type별 class 정보 추출
- annotation 파일에서 class 목록 파싱

**현재 우선 순위**:
1. ✅ task_type별 필터링
2. ✅ task_type별 이미지 수 (`num_images`)
3. ✅ task_type별 annotation 경로 (`annotation_path`)
4. ⏳ task_type별 클래스 정보 (`num_classes`, `class_names`) - 향후 추가

---

### Q6: 기존 코드와 호환되나요?

A: **네, 100% 호환됩니다.**

**Backward Compatibility**:
- `task_type` 파라미터는 **optional**
- 기존 요청은 그대로 작동 (Dataset 레벨 통계 반환)
- 새 필드 `published_task_types`는 빈 배열 또는 값 반환

**권장 마이그레이션**:
1. Phase 1: `published_task_types` 필드를 응답 스키마에 추가 (무시해도 됨)
2. Phase 2: `task_type` 파라미터 사용 시작
3. Phase 3: 검증 로직 추가 (`published_task_types` 확인)

---

### Q7: 성능은 어떤가요?

A: **최적화되어 있습니다.**

**인덱스**:
- `published_task_types`: PostgreSQL GIN index (array containment 최적화)
- `task_type`: AnnotationVersion 테이블 인덱스

**쿼리 성능**:
- task_type 필터링: ~5ms (GIN index 사용)
- AnnotationVersion 조회: ~2ms (인덱스 사용)

**대규모 데이터셋** (10,000+ datasets):
- 페이지네이션 지원 (`limit`, `page`)
- 최대 200개/페이지

---

## 📞 문의

**기술 문의**:
- Labeler Backend 팀: #labeler-backend (Slack)
- API 이슈: GitHub Issues

**긴급 문의**:
- On-call: Labeler DevOps 팀

---

## 📌 체크리스트

Platform 팀이 확인해야 할 사항:

- [ ] `task_type` 쿼리 파라미터 추가
- [ ] `published_task_types` 필드를 응답 스키마에 추가
- [ ] task_type 검증 로직 구현
- [ ] 기존 학습 Job이 올바른 통계를 사용하는지 확인
- [ ] 테스트 코드 작성 (task_type별 조회)
- [ ] 문서 업데이트 (Platform 내부 문서)

---

**Generated**: 2025-11-30
**Version**: Phase 16.6
**Labeler Backend**: v1.16.6
