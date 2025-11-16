# Data Management & Version Control Strategy

**작성일**: 2025-11-16
**상태**: In Progress
**관련 문서**: `ANNOTATION_STATE_VERSION_DESIGN.md`, `PRODUCTION_STORAGE_STRATEGY.md`

---

## 1. 개요

### 1.1 목적
Vision AI Labeler의 데이터 관리 및 버전 관리 전략을 정의합니다.
- Annotation 데이터의 저장 및 버전 관리
- Platform S3와 Labeler S3 간의 역할 분담
- 데이터 유실 방지 및 복구 전략
- DICE Format 기반 데이터 교환

### 1.2 핵심 요구사항
1. **데이터 유실 방지**: 작업 중 데이터가 절대 손실되지 않아야 함
2. **DICE Format 호환**: Platform의 표준 포맷 유지
3. **버전 관리**: Working version과 Published version 구분
4. **실시간 백업**: 주기적인 자동 저장
5. **복구 가능성**: 언제든지 이전 상태로 복구 가능

---

## 2. 핵심 개념 정의

### 2.1 Confirmation 레벨

#### Level 1: Annotation Confirm
- **대상**: 개별 annotation (bbox, polygon 등)
- **상태 전이**: draft → confirmed
- **저장 위치**: Labeler DB
- **의미**: 사용자가 해당 annotation이 올바르다고 확인
- **트리거**: RightPanel의 [✓] 버튼 또는 Bulk confirm

#### Level 2: Image Confirm
- **대상**: 이미지 1장의 모든 annotations
- **상태 전이**: in-progress → completed
- **저장 위치**: Labeler DB (image_annotation_status)
- **의미**: 해당 이미지의 라벨링 작업 완료
- **트리거**: Canvas의 "Confirm & Next" 버튼 (Ctrl+Enter)
- **부수 효과**:
  - 모든 draft annotations → confirmed
  - Image status → completed
  - is_image_confirmed = true

#### Level 3: Dataset Publish (Version Publish)
- **대상**: 프로젝트의 전체 annotations
- **상태 전이**: Working → Published version
- **저장 위치**:
  - Labeler DB (annotation_versions, annotation_snapshots)
  - Labeler S3 (DICE format + COCO/YOLO)
  - Platform S3 (DICE format - 최종 배포)
- **의미**: 공식 버전으로 확정 및 배포
- **트리거**: "Publish Version" 버튼
- **버전 번호**: v1.0, v2.0, v3.0 (major version)

---

### 2.2 Version 체계

#### Working Version (작업 버전)
- **버전 번호**: v0.1, v0.2, v0.3, ...
- **목적**: 작업 중 진행 상황 자동 백업
- **저장 주기**:
  - 10개 이미지 confirm 시
  - 30분 경과 시
  - 브라우저 닫기 전 (beforeunload)
- **포맷**: DICE format
- **저장 위치**: Labeler S3 (`datasets/{dataset_id}/working/`)
- **특징**:
  - Draft annotations 포함
  - 자동 증가 (auto-increment)
  - 덮어쓰기 가능 (mutable)
  - Platform에 공개되지 않음

#### Published Version (발행 버전)
- **버전 번호**: v1.0, v2.0, v3.0, ...
- **목적**: 공식 배포 및 외부 export
- **저장 시점**: 사용자가 명시적으로 "Publish" 클릭
- **포맷**: DICE + COCO + YOLO
- **저장 위치**:
  - Labeler S3 (`exports/{project_id}/{version}/`)
  - Platform S3 (`datasets/{dataset_id}/annotations.json`) - DICE only
- **특징**:
  - Confirmed annotations만 포함
  - 불변 (immutable) - snapshot 방식
  - Platform에 공개
  - 다운로드 가능

---

## 3. 데이터 저장 전략

### 3.1 저장소별 역할

#### Labeler Database (PostgreSQL)
- **역할**: Single Source of Truth (실시간 작업 데이터)
- **저장 내용**:
  - Annotations (draft, confirmed, verified)
  - Image annotation status
  - Annotation versions (metadata)
  - Annotation snapshots (version별 불변 데이터)
- **특징**:
  - 실시간 CRUD 작업
  - Transactional consistency
  - 복잡한 쿼리 및 필터링 지원

#### Platform Database (PostgreSQL)
- **역할**: 데이터셋 메타데이터 및 사용자 정보
- **저장 내용**:
  - Datasets (id, name, num_items)
  - Users (id, name, email)
- **특징**:
  - Read-only (Labeler 입장에서)
  - 공유 데이터

#### Platform S3 (이미지 저장소)
- **Bucket**: `s3://platform-datasets/`
- **역할**: 원본 이미지 및 최종 발행된 annotations 저장
- **저장 구조**:
```
s3://platform-datasets/
└── {dataset_id}/
    ├── images/
    │   ├── img_001.jpg
    │   ├── img_002.jpg
    │   └── ...
    └── annotations.json          # 최신 Published version (DICE)
```
- **annotations.json**:
  - 최초: 데이터셋 생성 시 업로드 (비어있거나 기존 데이터)
  - 업데이트: Version publish 시에만 (v1.0, v2.0, ...)
  - 포맷: DICE format
- **특징**:
  - 이미지는 불변 (immutable)
  - annotations.json은 publish 시에만 덮어쓰기
  - Labeler는 이미지 read-only, annotations write

#### Labeler S3 (작업 데이터 및 Export)
- **Bucket**: `s3://labeler-annotations/`
- **역할**: 작업 중 백업 및 export 파일 저장
- **저장 구조**:
```
s3://labeler-annotations/
├── datasets/
│   └── {dataset_id}/
│       └── working/
│           ├── annotations.json       # Working version (DICE)
│           └── metadata.json          # Working version 메타데이터
└── exports/
    └── {project_id}/
        ├── v1.0/
        │   ├── annotations_dice.json  # DICE format
        │   ├── annotations_coco.json  # COCO format
        │   └── annotations_yolo.zip   # YOLO format
        ├── v2.0/
        │   └── ...
        └── working/
            └── v0.3/
                └── annotations_dice.json  # Working snapshot
```
- **특징**:
  - Working version: 자동 백업용 (실시간)
  - Exports: Published version의 여러 포맷
  - Presigned URLs (7일 만료)

---

## 4. S3 데이터 흐름 및 연동

### 4.1 초기 데이터 로드
```
[Platform S3] → [Labeler Backend] → [Labeler DB]
    ↓
datasets/{id}/annotations.json (DICE)
    ↓
Parse & Import
    ↓
Annotations table (draft/confirmed)
```

### 4.2 작업 중 (Working Version)
```
[User Action] → [Labeler DB] → [Labeler S3]
    ↓              ↓                ↓
Confirm Image  Update DB    Auto-save every 10 images
    ↓              ↓                ↓
                Annotations  datasets/{id}/working/annotations.json
```

**트리거 조건**:
- ✅ 10개 이미지 confirm
- ✅ 30분 경과 (타이머)
- ✅ beforeunload (브라우저 닫기)

**Working Version 저장 프로세스**:
```python
1. Query confirmed annotations from DB
2. Convert to DICE format
3. Upload to Labeler S3: datasets/{id}/working/annotations.json
4. Create working version record in DB (optional, for tracking)
```

### 4.3 Version Publish
```
[User: Publish] → [Labeler DB] → [Labeler S3] → [Platform S3]
    ↓                 ↓               ↓               ↓
Publish v1.0    Create snapshot  Export files   Update official
    ↓                 ↓               ↓               ↓
            annotation_versions  DICE+COCO+YOLO  annotations.json
            annotation_snapshots
```

**Publish 프로세스 상세**:
```
Step 1: Create Version Record
- version_number = "v1.0" (auto-increment)
- version_type = "published"
- annotation_count, image_count

Step 2: Create Snapshots (DB)
- Query all confirmed annotations
- Insert into annotation_snapshots (JSONB)
- Immutable record

Step 3: Generate Exports (Labeler S3)
- DICE format → exports/{project_id}/v1.0/annotations_dice.json
- COCO format → exports/{project_id}/v1.0/annotations_coco.json
- YOLO format → exports/{project_id}/v1.0/annotations_yolo.zip
- Generate presigned URLs (7 days)

Step 4: Update Platform S3 (Official)
- Copy DICE to Platform S3 → datasets/{dataset_id}/annotations.json
- Overwrite previous version
- This becomes the official dataset annotation
```

---

## 5. Confirmation & Version 워크플로우

### 5.1 Annotation Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│                  Annotation States                       │
└─────────────────────────────────────────────────────────┘

[Create Bbox] → [Draft] ──────┐
                  ↓            │
         Auto-save to DB       │
                  ↓            │
         [Stored in Labeler DB]│
                               │
                               ↓
            [User: Confirm Annotation]
                               ↓
                          [Confirmed]
                               ↓
                 [Still in Labeler DB only]
                               ↓
            [User: Confirm Image (Ctrl+Enter)]
                               ↓
         [All annotations → Confirmed]
         [Image status → Completed]
                               ↓
        [Auto-save Working Version to S3]
        (Every 10 images or 30 min)
                               ↓
                [Working v0.1, v0.2, ...]
                               ↓
            [User: Publish Version]
                               ↓
            [Published v1.0, v2.0, ...]
                               ↓
        ┌───────────────┬───────────────┬──────────────┐
        ↓               ↓               ↓              ↓
  [Labeler DB]   [Labeler S3]   [Labeler S3]  [Platform S3]
   Snapshots      DICE format     COCO/YOLO    DICE (official)
```

### 5.2 Image Confirmation 시 동작

**Before Confirm**:
```
Image: "img_001.jpg"
Status: in-progress
Annotations: 5 total (3 confirmed, 2 draft)
```

**User clicks "Confirm & Next"**:
```
1. Set all draft → confirmed
   - annotation_state = 'confirmed'
   - confirmed_at = NOW()
   - confirmed_by = current_user.id

2. Update image status
   - status = 'completed'
   - is_image_confirmed = true
   - confirmed_at = NOW()

3. Check auto-save trigger
   - confirmed_image_count += 1
   - IF confirmed_image_count % 10 == 0:
       → Trigger working version save

4. Navigate to next not-started image
```

### 5.3 Working Version Auto-Save

**트리거 조건** (OR 관계):
- ✅ Confirmed images >= 10개 (배치)
- ✅ 마지막 저장 후 30분 경과 (타이머)
- ✅ window.beforeunload (브라우저 닫기)

**저장 프로세스**:
```python
async def save_working_version(project_id: str, db: Session):
    """
    Save current work as working version in DICE format.
    """
    # 1. Query all confirmed annotations
    annotations = db.query(Annotation).filter(
        Annotation.project_id == project_id,
        Annotation.annotation_state.in_(['confirmed', 'verified'])
    ).all()

    # 2. Convert to DICE format
    dice_data = export_to_dice(
        db=db,
        project_id=project_id,
        include_draft=False  # Working version: confirmed only
    )

    # 3. Increment working version
    last_working = get_last_working_version(project_id)
    new_version = increment_version(last_working)  # v0.1 → v0.2

    # 4. Upload to Labeler S3
    s3_key = f"datasets/{dataset_id}/working/annotations.json"
    upload_to_s3(s3_key, dice_data)

    # 5. Optional: Create version record in DB
    create_working_version_record(
        project_id=project_id,
        version_number=new_version,
        annotation_count=len(annotations)
    )

    # 6. Reset counter
    reset_auto_save_counter(project_id)
```

### 5.4 Version Publish 상세

**사용자 액션**:
```
TopBar → [Publish Version] 버튼 클릭
  ↓
Modal 표시:
  - Version number: v1.0 (auto) or custom
  - Description: "Initial release"
  - Export formats: [✓] DICE [✓] COCO [✓] YOLO
  - Include draft: [ ] (default: unchecked)
  ↓
[Publish] 버튼 클릭
```

**백엔드 프로세스**:
```python
async def publish_version(project_id: str, request: VersionPublishRequest):
    """
    Publish new version with snapshots and exports.
    """
    # 1. Validate and generate version number
    version_number = request.version_number or auto_generate_version()

    # 2. Query annotations
    query = db.query(Annotation).filter(project_id=project_id)
    if not request.include_draft:
        query = query.filter(annotation_state.in_(['confirmed', 'verified']))
    annotations = query.all()

    # 3. Create version record
    version = AnnotationVersion(
        project_id=project_id,
        version_number=version_number,
        version_type='published',
        annotation_count=len(annotations),
        ...
    )
    db.add(version)
    db.flush()

    # 4. Create snapshots (immutable)
    for ann in annotations:
        snapshot = AnnotationSnapshot(
            version_id=version.id,
            annotation_id=ann.id,
            snapshot_data={...}  # Full annotation JSON
        )
        db.add(snapshot)

    # 5. Generate exports
    exports = {}

    # DICE format
    dice_data = export_to_dice(db, project_id, include_draft)
    dice_bytes = json.dumps(dice_data).encode()
    exports['dice'] = upload_export(
        project_id, version_number, dice_bytes, 'dice', 'annotations_dice.json'
    )

    # COCO format (optional)
    if 'coco' in request.export_formats:
        coco_data = export_to_coco(db, project_id, include_draft)
        coco_bytes = json.dumps(coco_data).encode()
        exports['coco'] = upload_export(
            project_id, version_number, coco_bytes, 'coco', 'annotations_coco.json'
        )

    # YOLO format (optional)
    if 'yolo' in request.export_formats:
        yolo_zip = export_to_yolo(db, project_id, include_draft)
        exports['yolo'] = upload_export(
            project_id, version_number, yolo_zip, 'yolo', 'annotations_yolo.zip'
        )

    # 6. Update version record with export paths
    version.export_path = exports['dice']['s3_key']
    version.download_url = exports['dice']['presigned_url']
    version.download_url_expires_at = exports['dice']['expires_at']

    # 7. Update Platform S3 (official annotations.json)
    await update_platform_annotations(
        dataset_id=project.dataset_id,
        dice_data=dice_data
    )

    db.commit()
    return version
```

**Platform S3 업데이트**:
```python
async def update_platform_annotations(dataset_id: str, dice_data: dict):
    """
    Update official annotations.json in Platform S3.
    """
    # Convert DICE data to JSON bytes
    json_bytes = json.dumps(dice_data, indent=2).encode('utf-8')

    # Upload to Platform S3
    platform_s3_client.put_object(
        Bucket='platform-datasets',
        Key=f'{dataset_id}/annotations.json',
        Body=json_bytes,
        ContentType='application/json',
        Metadata={
            'dataset_id': dataset_id,
            'version': version_number,
            'updated_at': datetime.utcnow().isoformat()
        }
    )
```

---

## 6. DICE Format Export Service

### 6.1 서비스 구현

```python
# backend/app/services/dice_export_service.py

def export_to_dice(
    db: Session,
    platform_db: Session,
    project_id: str,
    include_draft: bool = False
) -> Dict[str, Any]:
    """
    Export annotations to DICE format.

    DICE Format Structure:
    {
      "format_version": "1.0",
      "dataset_id": "...",
      "task_type": "object_detection",
      "classes": [...],
      "images": [
        {
          "id": 1,
          "file_name": "img_001.jpg",
          "annotations": [...],
          "metadata": {
            "labeled_by": "user_id",
            "labeled_at": "...",
            "reviewed_by": "...",
            "reviewed_at": "..."
          }
        }
      ],
      "statistics": {...}
    }
    """
    # Get project
    project = db.query(AnnotationProject).filter_by(id=project_id).first()

    # Get dataset
    dataset = platform_db.query(Dataset).filter_by(id=project.dataset_id).first()

    # Build annotation query
    query = db.query(Annotation).filter(project_id=project_id)
    if not include_draft:
        query = query.filter(annotation_state.in_(['confirmed', 'verified']))

    annotations = query.all()

    # Group by image
    images_dict = {}
    for ann in annotations:
        if ann.image_id not in images_dict:
            images_dict[ann.image_id] = {
                'annotations': [],
                'metadata': {}
            }
        images_dict[ann.image_id]['annotations'].append(ann)

    # Build DICE structure
    dice_images = []
    for image_id, data in images_dict.items():
        # Get image metadata from image_annotation_status
        status = db.query(ImageAnnotationStatus).filter(
            project_id=project_id,
            image_id=image_id
        ).first()

        dice_image = {
            "id": len(dice_images) + 1,
            "file_name": image_id,
            "width": 0,  # TODO: Get from S3 metadata or store in DB
            "height": 0,
            "annotations": [
                convert_annotation_to_dice(ann)
                for ann in data['annotations']
            ],
            "metadata": {
                "labeled_by": data['annotations'][0].created_by if data['annotations'] else None,
                "labeled_at": data['annotations'][0].created_at.isoformat() if data['annotations'] else None,
                "reviewed_by": status.confirmed_by if status and status.is_image_confirmed else None,
                "reviewed_at": status.confirmed_at.isoformat() if status and status.confirmed_at else None,
            }
        }
        dice_images.append(dice_image)

    # Build final DICE data
    dice_data = {
        "format_version": "1.0",
        "dataset_id": project.dataset_id,
        "dataset_name": dataset.name if dataset else project.name,
        "task_type": project.task_types[0] if project.task_types else "object_detection",
        "created_at": project.created_at.isoformat(),
        "last_modified_at": datetime.utcnow().isoformat(),
        "version": get_version_number(project_id),
        "classes": convert_classes_to_dice(project.classes),
        "images": dice_images,
        "statistics": calculate_statistics(dice_images, project.classes)
    }

    return dice_data


def convert_annotation_to_dice(ann: Annotation) -> Dict[str, Any]:
    """Convert DB annotation to DICE annotation format."""
    if ann.annotation_type == 'bbox':
        return {
            "id": ann.id,
            "class_id": ann.class_id,
            "class_name": ann.class_name,
            "bbox": [
                ann.geometry['x'],
                ann.geometry['y'],
                ann.geometry['width'],
                ann.geometry['height']
            ],
            "bbox_format": "xywh",
            "area": ann.geometry['width'] * ann.geometry['height'],
            "iscrowd": 0
        }
    # TODO: Handle other annotation types (polygon, etc.)
    return {}


def convert_classes_to_dice(classes: List[Dict]) -> List[Dict]:
    """Convert project classes to DICE format."""
    dice_classes = []
    for idx, cls in enumerate(classes):
        dice_classes.append({
            "id": idx,
            "name": cls.get('name'),
            "color": cls.get('color'),
            "supercategory": cls.get('supercategory', 'object')
        })
    return dice_classes


def calculate_statistics(images: List[Dict], classes: List[Dict]) -> Dict:
    """Calculate dataset statistics."""
    total_annotations = sum(len(img['annotations']) for img in images)

    class_distribution = {}
    for img in images:
        for ann in img['annotations']:
            class_name = ann['class_name']
            class_distribution[class_name] = class_distribution.get(class_name, 0) + 1

    return {
        "total_images": len(images),
        "total_annotations": total_annotations,
        "avg_annotations_per_image": total_annotations / len(images) if images else 0,
        "class_distribution": class_distribution
    }
```

---

## 7. 데이터 복구 전략

### 7.1 복구 시나리오

#### Scenario 1: 브라우저 크래시 (작업 중 유실)
```
Problem: 사용자가 50개 이미지 confirm 후 브라우저 크래시

Recovery:
1. Labeler DB에 모든 confirmed annotations 저장되어 있음
2. Working version이 Labeler S3에 백업되어 있음 (마지막 10개 단위)
3. 재접속 시 DB에서 자동 로드
4. 최대 10개 이미지의 작업만 위험 (마지막 auto-save 이후)

Solution:
- beforeunload 이벤트로 브라우저 닫기 전 auto-save
- 주기적 auto-save (30분)
```

#### Scenario 2: DB 손실
```
Problem: Labeler DB 서버 장애

Recovery:
1. 최신 Working version에서 복구
   - Labeler S3: datasets/{id}/working/annotations.json
2. DICE format → DB import
3. 최대 손실: 마지막 auto-save 이후 작업 (최대 10 images)

Solution:
- DB 백업 (daily snapshot)
- Working version이 secondary backup 역할
```

#### Scenario 3: 실수로 annotations 삭제
```
Problem: 사용자가 실수로 여러 annotations 삭제

Recovery:
1. annotation_history 테이블 조회 (undo/redo 기능)
2. 또는 이전 working version에서 복구
3. 또는 이전 published version의 snapshot에서 복구

Solution:
- History 기반 undo 기능 (Phase 2.2 구현 예정)
- Version snapshot (immutable)
```

### 7.2 데이터 일관성 보장

**Platform S3 ↔ Labeler DB 동기화**:
```
Initial Load:
Platform S3 (annotations.json) → Labeler DB (import)

Working:
Labeler DB → Labeler S3 (working/) [auto-save]

Publish:
Labeler DB → Labeler S3 (exports/) → Platform S3 (annotations.json)
```

**충돌 해결**:
- Platform S3의 annotations.json은 read-only (Labeler 입장)
- 업데이트는 publish 시에만 (단방향)
- 동시 작업 시 Labeler DB가 최신 상태 유지

---

## 8. 구현 우선순위

### Phase 2.8 (현재)
- [x] Database migrations (versions, snapshots)
- [x] COCO export service
- [x] YOLO export service
- [x] Version publish API
- [ ] **DICE export service** ⭐ 우선 구현
- [ ] **Working version auto-save** ⭐ 우선 구현
- [ ] Frontend export modal
- [ ] Frontend version history

### Phase 2.9 (다음)
- [ ] beforeunload 이벤트 처리
- [ ] Auto-save 타이머 (30분)
- [ ] Working version 관리 UI
- [ ] Platform S3 sync (publish 시)

---

## 9. 예시 시나리오

### 9.1 전체 작업 흐름 예시

```
Day 1:
------
User: 프로젝트 시작, 100개 이미지 로드
- Platform S3에서 annotations.json 로드 (비어있음)
- Labeler DB에 프로젝트 생성

User: 이미지 10개 작업 및 confirm
- DB에 50개 annotations 생성 (confirmed)
- Image 10개 status = completed
- Auto-save triggered → Working v0.1 생성
  - Labeler S3: datasets/ds_123/working/annotations.json

User: 이미지 20개 더 작업 및 confirm
- DB에 100개 annotations 누적
- Auto-save triggered → Working v0.2 생성

User: 브라우저 닫음
- beforeunload → Working v0.3 생성 (30개 이미지)


Day 2:
------
User: 재접속
- DB에서 자동 로드 (30개 이미지 confirmed)
- 이어서 작업 가능

User: 나머지 70개 이미지 작업 완료
- 총 100개 이미지 모두 confirmed
- Working v0.4, v0.5, ... v0.10 생성됨

User: "Publish Version" 클릭
- Version v1.0 발행
- Labeler S3:
  - exports/proj_123/v1.0/annotations_dice.json
  - exports/proj_123/v1.0/annotations_coco.json
  - exports/proj_123/v1.0/annotations_yolo.zip
- Platform S3:
  - datasets/ds_123/annotations.json (DICE) ← 업데이트됨
- DB:
  - annotation_versions (v1.0)
  - annotation_snapshots (500개 annotations)


Day 3:
------
User: 이미지 50개 수정 작업
- 기존 annotations 수정 (unconfirm → modify → confirm)
- Working v0.11, v0.12 생성

User: "Publish Version" 클릭
- Version v2.0 발행
- Platform S3 annotations.json 덮어쓰기
- v1.0은 Labeler S3에 보존됨 (rollback 가능)
```

### 9.2 데이터 흐름 다이어그램

```
┌──────────────────────────────────────────────────────────────┐
│                    Data Flow Overview                         │
└──────────────────────────────────────────────────────────────┘

                     ┌─────────────┐
                     │   User UI   │
                     └──────┬──────┘
                            │
                  ┌─────────▼──────────┐
                  │  Frontend (React)  │
                  └─────────┬──────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌──────────────┐
│  Annotation   │   │     Image     │   │   Publish    │
│    Confirm    │   │    Confirm    │   │   Version    │
└───────┬───────┘   └───────┬───────┘   └──────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    ┌───────▼────────┐
                    │ Labeler Backend│
                    └───────┬────────┘
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                    │
        ▼                   ▼                    ▼
┌───────────────┐   ┌────────────────┐   ┌──────────────┐
│  Labeler DB   │   │  Labeler S3    │   │ Platform S3  │
│               │   │                │   │              │
│ • annotations │   │ • working/     │   │ • images/    │
│ • versions    │   │ • exports/     │   │ • annotations│
│ • snapshots   │   │                │   │   .json      │
└───────────────┘   └────────────────┘   └──────────────┘
```

---

## 10. 참고 자료

### 관련 문서
- `ANNOTATION_STATE_VERSION_DESIGN.md`: Confirmation 및 Version 관리 설계
- `PRODUCTION_STORAGE_STRATEGY.md`: S3 마이그레이션 계획
- `docs/dice_format/`: DICE format 예시 파일들

### API Endpoints
- `POST /api/v1/projects/{projectId}/export`: Export annotations
- `POST /api/v1/projects/{projectId}/versions/publish`: Publish version
- `GET /api/v1/projects/{projectId}/versions`: List versions

### Database Tables
- `annotations`: 실시간 annotation 데이터
- `image_annotation_status`: 이미지별 상태 추적
- `annotation_versions`: 버전 메타데이터
- `annotation_snapshots`: 버전별 불변 snapshot

---

**최종 업데이트**: 2025-11-16
**작성자**: Development Team
**리뷰 필요**: Product Owner, Tech Lead
