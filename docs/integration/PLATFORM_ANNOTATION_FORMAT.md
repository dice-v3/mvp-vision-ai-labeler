# Platform 팀 - Annotation 파일 형식 가이드

**작성일**: 2025-11-30
**Phase**: 16.6 (Image Storage Information)
**대상**: Platform Backend 개발팀

---

## 📋 개요

Labeler가 export하는 annotation 파일에는 **storage_info** 섹션이 포함되어 있어,
Platform 팀이 이미지 파일의 S3/R2 위치를 찾을 수 있습니다.

---

## 🗂️ Annotation 파일 형식

### DICE 형식 (권장)

```json
{
  "format_version": "1.0",
  "dataset_id": "ds_c75023ca76d7448b",
  "dataset_name": "mvtec-ad",
  "task_type": "object_detection",

  // ← Phase 16.6: 이미지 저장 위치 정보
  "storage_info": {
    "storage_type": "s3",                              // 또는 "r2"
    "bucket": "training-datasets",                     // S3/R2 버킷 이름
    "image_root": "datasets/ds_c75023ca76d7448b/images/"  // 이미지 root 경로
  },

  "classes": [
    {"id": 0, "name": "defect", "color": "#FF0000"}
  ],

  "images": [
    {
      "id": 1,
      "file_name": "zipper/squeezed_teeth/000.png",  // 상대 경로
      "width": 1024,
      "height": 1024,
      "split": "train",
      "annotations": [...]
    }
  ],

  "statistics": {...}
}
```

### COCO 형식

```json
{
  "info": {...},
  "licenses": [...],

  // ← Phase 16.6: 이미지 저장 위치 정보
  "storage_info": {
    "storage_type": "s3",
    "bucket": "training-datasets",
    "image_root": "datasets/ds_c75023ca76d7448b/images/"
  },

  "images": [
    {
      "id": 1,
      "file_name": "zipper/squeezed_teeth/000.png",
      "width": 1024,
      "height": 1024
    }
  ],

  "annotations": [...],
  "categories": [...]
}
```

---

## 🔍 storage_info 필드 설명

| 필드 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `storage_type` | string | 스토리지 타입 | `"s3"`, `"r2"` |
| `bucket` | string | S3/R2 버킷 이름 | `"training-datasets"` |
| `image_root` | string | 이미지 파일들의 root prefix | `"datasets/ds_c75023ca76d7448b/images/"` |

---

## 💡 이미지 다운로드 방법

### Python 예시 (boto3 사용)

```python
import json
import boto3
from pathlib import Path

# 1. Annotation 파일 파싱
with open('annotations.json', 'r') as f:
    annotation = json.load(f)

storage_info = annotation['storage_info']
print(f"Bucket: {storage_info['bucket']}")
print(f"Image Root: {storage_info['image_root']}")

# 2. S3 클라이언트 초기화
s3_client = boto3.client(
    's3',
    endpoint_url='https://your-r2-endpoint.r2.cloudflarestorage.com',  # R2 사용 시
    aws_access_key_id='YOUR_ACCESS_KEY',
    aws_secret_access_key='YOUR_SECRET_KEY'
)

# 3. 각 이미지 다운로드
for image in annotation['images']:
    # Full S3 key 구성
    s3_key = storage_info['image_root'] + image['file_name']
    # 예: "datasets/ds_c75023ca76d7448b/images/zipper/squeezed_teeth/000.png"

    # 로컬 경로
    local_path = Path('dataset') / image['file_name']
    local_path.parent.mkdir(parents=True, exist_ok=True)

    # 다운로드
    print(f"Downloading {s3_key} -> {local_path}")
    s3_client.download_file(
        Bucket=storage_info['bucket'],
        Key=s3_key,
        Filename=str(local_path)
    )

print(f"Downloaded {len(annotation['images'])} images")
```

### Python 예시 (간단한 함수)

```python
def download_dataset_images(annotation_path: str, output_dir: str):
    """
    Annotation 파일에서 storage_info를 읽고 모든 이미지를 다운로드.

    Args:
        annotation_path: Annotation JSON 파일 경로
        output_dir: 이미지를 저장할 로컬 디렉토리
    """
    import json
    import boto3
    from pathlib import Path

    # Annotation 파일 로드
    with open(annotation_path, 'r') as f:
        data = json.load(f)

    storage_info = data['storage_info']

    # S3 클라이언트 초기화 (환경변수에서 credentials 읽음)
    s3 = boto3.client('s3')

    # 각 이미지 다운로드
    for img in data['images']:
        s3_key = storage_info['image_root'] + img['file_name']
        local_file = Path(output_dir) / img['file_name']
        local_file.parent.mkdir(parents=True, exist_ok=True)

        s3.download_file(
            Bucket=storage_info['bucket'],
            Key=s3_key,
            Filename=str(local_file)
        )

    return len(data['images'])


# 사용 예시
num_images = download_dataset_images(
    annotation_path='annotations.json',
    output_dir='/tmp/dataset'
)
print(f"Downloaded {num_images} images")
```

---

## 📂 디렉토리 구조

### S3/R2 버킷 구조

```
training-datasets/
└── datasets/
    └── ds_c75023ca76d7448b/
        └── images/                           ← storage_info.image_root
            ├── zipper/
            │   ├── squeezed_teeth/
            │   │   ├── 000.png              ← image.file_name
            │   │   ├── 001.png
            │   │   └── ...
            │   └── thread/
            │       ├── 000.png
            │       └── ...
            └── ...
```

### 다운로드 후 로컬 구조

```
/tmp/dataset/
├── zipper/
│   ├── squeezed_teeth/
│   │   ├── 000.png
│   │   ├── 001.png
│   │   └── ...
│   └── thread/
│       ├── 000.png
│       └── ...
└── ...
```

---

## ⚠️ 주의사항

### 1. storage_info는 필수 필드입니다

**Phase 16.6 이후 export된 annotation 파일**에는 항상 `storage_info`가 포함됩니다.

만약 `storage_info`가 없는 파일을 받으면:
- Legacy 파일 (Phase 16.6 이전)
- Labeler backend 버전 확인 필요

### 2. image_root는 항상 `/`로 끝남

```python
# 올바른 사용
s3_key = storage_info['image_root'] + image['file_name']
# "datasets/ds_c75023ca76d7448b/images/" + "zipper/000.png"
# = "datasets/ds_c75023ca76d7448b/images/zipper/000.png"

# 잘못된 사용 (슬래시 중복)
s3_key = storage_info['image_root'] + '/' + image['file_name']
# "datasets/ds_c75023ca76d7448b/images/" + "/" + "zipper/000.png"
# = "datasets/ds_c75023ca76d7448b/images//zipper/000.png"  ← 슬래시 중복!
```

### 3. Cloudflare R2 사용 시 endpoint 설정 필요

```python
# R2 사용 시
s3_client = boto3.client(
    's3',
    endpoint_url='https://ACCOUNT_ID.r2.cloudflarestorage.com',  # ← 필수!
    aws_access_key_id='...',
    aws_secret_access_key='...',
    region_name='auto'  # R2는 'auto'
)

# AWS S3 사용 시
s3_client = boto3.client(
    's3',
    # endpoint_url 불필요
    region_name='us-east-1'
)
```

---

## ❓ FAQ

### Q1: storage_info가 없는 annotation 파일을 받으면?

**A**: Phase 16.6 이전에 export된 파일입니다.
Labeler API의 `PlatformDatasetResponse`에서 `storage_path`를 사용하세요:

```python
# Legacy 지원
if 'storage_info' not in annotation:
    # Platform API 응답에서 가져온 dataset 정보 사용
    storage_info = {
        'bucket': 'training-datasets',
        'image_root': f"{dataset['storage_path']}images/"
    }
```

### Q2: file_name에 절대 경로가 들어있나요?

**A**: 아니요, 항상 **상대 경로**입니다.

```json
{
  "file_name": "zipper/squeezed_teeth/000.png"  // ← 상대 경로만
}
```

Full S3 key는 `image_root + file_name`으로 구성합니다.

### Q3: 여러 task_type의 annotation을 받으면?

**A**: 각 task_type마다 **별도의 annotation 파일**을 받습니다.

```
dataset_id: ds_abc123

# Detection annotation
GET /api/v1/platform/datasets?task_type=detection
→ annotation_path: exports/.../detection/v5.0/annotations.json
→ storage_info.image_root: datasets/ds_abc123/images/

# Segmentation annotation
GET /api/v1/platform/datasets?task_type=segmentation
→ annotation_path: exports/.../segmentation/v3.0/annotations.json
→ storage_info.image_root: datasets/ds_abc123/images/  ← 동일!
```

**중요**: `storage_info`는 동일하고 (같은 데이터셋),
annotation 내용만 다릅니다 (task별로 다른 annotation).

### Q4: 이미지가 너무 많으면?

**A**: 병렬 다운로드를 사용하세요:

```python
from concurrent.futures import ThreadPoolExecutor

def download_image(s3_client, bucket, s3_key, local_path):
    """단일 이미지 다운로드"""
    local_path.parent.mkdir(parents=True, exist_ok=True)
    s3_client.download_file(Bucket=bucket, Key=s3_key, Filename=str(local_path))
    return s3_key

# 병렬 다운로드 (10 workers)
with ThreadPoolExecutor(max_workers=10) as executor:
    futures = []
    for img in annotation['images']:
        s3_key = storage_info['image_root'] + img['file_name']
        local_path = Path(output_dir) / img['file_name']

        future = executor.submit(
            download_image,
            s3_client,
            storage_info['bucket'],
            s3_key,
            local_path
        )
        futures.append(future)

    # 완료 대기
    for future in futures:
        future.result()
```

---

## 📞 문의

**기술 문의**:
- Labeler Backend 팀: #labeler-backend (Slack)
- Annotation 형식 이슈: GitHub Issues

---

**Generated**: 2025-11-30
**Version**: Phase 16.6
**Labeler Backend**: v1.16.6
