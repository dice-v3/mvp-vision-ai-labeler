# Annotation File Management Strategy Analysis

## 목차
1. [개요](#개요)
2. [두 가지 접근 방식](#두-가지-접근-방식)
3. [상세 비교 분석](#상세-비교-분석)
4. [기존 레이블링 툴 사례 분석](#기존-레이블링-툴-사례-분석)
5. [성능 및 확장성 분석](#성능-및-확장성-분석)
6. [권장사항](#권장사항)

---

## 개요

Multi-task annotation 환경에서 annotation 데이터를 어떻게 파일로 저장할지는 중요한 아키텍처 결정입니다.

### 핵심 질문
- **하나의 통합 파일**에 모든 task의 annotation을 저장할 것인가?
- **Task별로 분리된 파일**로 관리할 것인가?

---

## 두 가지 접근 방식

### 방식 A: 통합 파일 (Unified File)

```
dataset_01/
├── images/
│   ├── car1.jpg
│   └── car2.jpg
└── annotations.json  ← 하나의 파일
```

**annotations.json**:
```json
{
  "images": [
    {
      "id": 1,
      "file_name": "car1.jpg",
      "annotations": [
        {"type": "bbox", "bbox": [10, 20, 100, 50], "class_id": "car"},
        {"type": "bbox", "bbox": [200, 30, 80, 60], "class_id": "truck"},
        {"type": "classification", "class_id": "vehicle"},
        {"type": "polygon", "points": [[...]], "class_id": "car"}
      ]
    }
  ]
}
```

### 방식 B: 태스크별 분리 파일 (Task-Separated Files)

```
dataset_01/
├── images/
│   ├── car1.jpg
│   └── car2.jpg
├── annotations_detection.json      ← Detection용
├── annotations_classification.json ← Classification용
└── annotations_segmentation.json   ← Segmentation용
```

**annotations_detection.json**:
```json
{
  "images": [
    {
      "id": 1,
      "file_name": "car1.jpg",
      "annotations": [
        {"bbox": [10, 20, 100, 50], "class_id": "car"},
        {"bbox": [200, 30, 80, 60], "class_id": "truck"}
      ]
    }
  ]
}
```

**annotations_classification.json**:
```json
{
  "images": [
    {"id": 1, "file_name": "car1.jpg", "class_id": "vehicle"}
  ]
}
```

---

## 상세 비교 분석

### 1. 데이터 일관성 (Data Consistency)

#### 통합 파일 ✅
- **장점**:
  - 이미지와 모든 annotation이 원자적 단위(atomic unit)
  - 트랜잭션 관리 간단 (하나의 파일만 write)
  - 버전 관리 시 단일 파일로 스냅샷 가능
  - 이미지 삭제 시 모든 관련 annotation 동시 처리

- **단점**:
  - 파일이 커질 수 있음
  - 부분 업데이트 시 전체 파일 rewrite

#### 태스크별 분리 ✅
- **장점**:
  - Task별 독립적 업데이트 가능
  - 파일 크기 분산

- **단점**:
  - 동기화 문제 발생 가능
    - `annotations_detection.json`에는 있는데 `annotations_classification.json`에는 없는 이미지
  - 이미지 삭제 시 여러 파일 수정 필요
  - 트랜잭션 관리 복잡 (multi-file write)
  - 데이터 무결성 검증 어려움

**예시 문제**:
```
1. User: car1.jpg를 detection 작업
2. annotations_detection.json 업데이트 ✅
3. System crash ❌
4. annotations_classification.json 업데이트 실패
→ 불일치 상태!
```

---

### 2. 파일 크기 및 성능 (File Size & Performance)

#### 통합 파일
| 데이터셋 크기 | 예상 파일 크기 | 로딩 시간 (예상) |
|--------------|---------------|-----------------|
| 100 images | ~500 KB | <50ms |
| 1,000 images | ~5 MB | ~200ms |
| 10,000 images | ~50 MB | ~2s |
| 100,000 images | ~500 MB | ~20s ⚠️ |

**문제점**:
- 대규모 데이터셋에서 전체 파일 로딩 느림
- Memory overhead 큼

**해결책**:
- Pagination/Chunking (이미지 1000개씩 분할)
- Lazy loading
- Index 파일 별도 관리

#### 태스크별 분리
| Task | 파일 크기 (1,000 images) |
|------|-------------------------|
| Detection | ~3 MB (bbox 데이터) |
| Classification | ~50 KB (클래스만) |
| Segmentation | ~15 MB (polygon 좌표) |

**장점**:
- Task별 선택적 로딩 가능
  - Detection만 필요하면 3MB만 로드
- 메모리 효율적

**단점**:
- 전체 데이터 필요 시 여러 파일 로드
- Network I/O 증가 (S3 등에서)

---

### 3. 사용성 및 개발 편의성 (Usability & Developer Experience)

#### 통합 파일 ✅
```python
# 간단한 로딩
with open('annotations.json') as f:
    data = json.load(f)

# 모든 정보가 한 곳에
for image in data['images']:
    bboxes = [a for a in image['annotations'] if a['type'] == 'bbox']
    classes = [a for a in image['annotations'] if a['type'] == 'classification']
    polygons = [a for a in image['annotations'] if a['type'] == 'polygon']
```

#### 태스크별 분리 ⚠️
```python
# 여러 파일 로딩 필요
with open('annotations_detection.json') as f:
    detection_data = json.load(f)
with open('annotations_classification.json') as f:
    class_data = json.load(f)
with open('annotations_segmentation.json') as f:
    seg_data = json.load(f)

# 이미지별로 merge 필요
def merge_annotations(image_id):
    det = find_in(detection_data, image_id)
    cls = find_in(class_data, image_id)
    seg = find_in(seg_data, image_id)
    return {'detection': det, 'classification': cls, 'segmentation': seg}
```

---

### 4. 확장성 (Scalability)

#### 통합 파일
**새 Task 추가 시**:
- ✅ 동일한 구조에 `type` 필드만 추가
- ✅ 기존 코드 변경 최소화
- ❌ 파일 크기 증가

```json
{
  "annotations": [
    {"type": "bbox", ...},
    {"type": "keypoint", ...}  // ← 새 task 추가
  ]
}
```

#### 태스크별 분리
**새 Task 추가 시**:
- ❌ 새 파일 생성 필요
- ❌ 로딩 로직 수정 필요
- ❌ Export 로직 복잡도 증가

```
dataset_01/
├── annotations_detection.json
├── annotations_classification.json
├── annotations_segmentation.json
└── annotations_keypoint.json  // ← 새 파일 추가
```

---

### 5. 버전 관리 및 협업 (Version Control & Collaboration)

#### 통합 파일
**Git 관리**:
- ❌ Merge conflict 발생률 높음
  - A가 image 1 수정, B가 image 100 수정 → 같은 파일이라 conflict
- ❌ Diff 보기 어려움 (큰 JSON)
- ✅ 단일 파일이라 히스토리 추적 간단

**협업**:
```
User A: car1.jpg detection 작업 → annotations.json 수정
User B: car2.jpg classification 작업 → annotations.json 수정
→ Conflict! ⚠️
```

#### 태스크별 분리
**Git 관리**:
- ✅ Task별로 독립적 작업 가능
  - A는 detection, B는 classification → 다른 파일이라 conflict 없음
- ✅ Diff 명확
- ❌ 여러 파일 추적 필요

**협업**:
```
User A: detection 작업 → annotations_detection.json 수정
User B: classification 작업 → annotations_classification.json 수정
→ No conflict! ✅
```

---

### 6. 표준 준수 및 호환성 (Standard Compliance)

#### 통합 파일
- ✅ COCO format 기반 확장 (업계 표준)
- ✅ 대부분의 ML 프레임워크 지원
- ✅ 이식성 좋음 (하나의 파일만 이동)

#### 태스크별 분리
- ❌ 비표준 구조
- ❌ 외부 도구 호환성 낮음
- ❌ 데이터 공유 시 여러 파일 전달 필요

---

## 기존 레이블링 툴 사례 분석

### 1. COCO Dataset (MS COCO)

**방식**: **통합 파일** ✅

```
coco/
├── images/
└── annotations/
    ├── instances_train2017.json  ← Detection + Segmentation
    ├── captions_train2017.json   ← Caption (별도)
    └── person_keypoints_train2017.json  ← Keypoint (별도)
```

**구조**:
```json
{
  "images": [...],
  "annotations": [
    {
      "id": 1,
      "bbox": [x, y, w, h],        // detection
      "segmentation": [[...]],      // segmentation (optional)
      "area": 1000,
      "iscrowd": 0
    }
  ]
}
```

**특징**:
- Detection과 Segmentation은 **하나의 파일**
  - 같은 annotation에 `bbox`와 `segmentation` 동시 포함
- Caption과 Keypoint는 **별도 파일**
  - 데이터 구조가 완전히 다름

**이유**:
- Detection과 Segmentation은 instance-level task → 통합
- Caption은 image-level task → 분리
- Keypoint는 특수한 좌표 구조 → 분리

**시사점**:
- "유사한 task는 통합, 이질적인 task는 분리"

---

### 2. CVAT (Computer Vision Annotation Tool)

**방식**: **통합 파일** (Export 시)

**내부 저장**: PostgreSQL DB (정규화)
```sql
-- tasks, jobs, labels, shapes 테이블로 분리
```

**Export 형식**:
```xml
<!-- CVAT XML Format -->
<annotations>
  <image id="1" name="car1.jpg">
    <box label="car" xtl="10" ytl="20" xbr="110" ybr="70"/>
    <polygon label="car" points="10,20;30,40;..."/>
    <tag label="vehicle"/>  <!-- image-level tag -->
  </image>
</annotations>
```

**특징**:
- DB는 정규화 (테이블 분리)
- Export는 통합 (하나의 파일)
- 다양한 export 형식 지원 (COCO, YOLO, Pascal VOC)

**시사점**:
- "저장은 정규화, Export는 통합"
- 우리 현재 구조와 동일! ✅

---

### 3. LabelMe

**방식**: **이미지별 개별 파일** (특수 케이스)

```
dataset/
├── images/
│   ├── car1.jpg
│   └── car2.jpg
└── annotations/
    ├── car1.xml  ← car1.jpg의 모든 annotation
    └── car2.xml  ← car2.xml의 모든 annotation
```

**car1.xml**:
```xml
<annotation>
  <filename>car1.jpg</filename>
  <object>
    <name>car</name>
    <polygon><pt><x>10</x><y>20</y></pt>...</polygon>
  </object>
  <object>
    <name>truck</name>
    <polygon>...</polygon>
  </object>
</annotation>
```

**특징**:
- 이미지 1개 = 파일 1개
- 모든 task type이 하나의 XML에

**장점**:
- 이미지 단위 관리 용이
- 분산 작업 가능 (파일 충돌 없음)

**단점**:
- 대규모 데이터셋에서 파일 수 폭발
  - 10,000 이미지 = 10,000 XML 파일
- 전체 로딩 느림 (10,000번 파일 open)
- 통계 계산 어려움

**시사점**:
- 소규모 프로젝트에 적합
- 대규모에는 부적합

---

### 4. Labelbox

**방식**: **통합 JSON** (NDJSON)

```json
{"data_row_id": "1", "label": {"objects": [{"bbox": {...}}, {"polygon": {...}}]}}
{"data_row_id": "2", "label": {"objects": [{"bbox": {...}}]}}
```

**특징**:
- NDJSON (Newline Delimited JSON)
- 각 줄 = 하나의 이미지
- Streaming 가능

**장점**:
- 대규모 데이터 처리 효율적
- Partial loading 가능

**단점**:
- 표준 JSON parser로 읽기 어려움
- 사람이 읽기 불편

---

### 5. Supervisely

**방식**: **계층적 디렉토리 구조**

```
project/
├── meta.json  ← 프로젝트 전체 메타데이터
└── ds1/
    ├── ann/
    │   ├── car1.jpg.json  ← 이미지별 annotation
    │   └── car2.jpg.json
    └── img/
        ├── car1.jpg
        └── car2.jpg
```

**car1.jpg.json**:
```json
{
  "description": "",
  "size": {"height": 1080, "width": 1920},
  "objects": [
    {"classTitle": "car", "geometryType": "rectangle", "points": {...}},
    {"classTitle": "car", "geometryType": "polygon", "points": {...}}
  ],
  "tags": [
    {"name": "vehicle", "value": null}  // image-level tag
  ]
}
```

**특징**:
- LabelMe와 유사 (이미지별 파일)
- 모든 task가 `objects` 배열에 통합
- Image-level tag는 별도 `tags` 배열

**시사점**:
- Instance-level은 통합 (`objects`)
- Image-level은 분리 (`tags`)

---

### 6. Label Studio

**방식**: **통합 JSON** + **Task별 Export 옵션**

**내부 저장**:
```json
{
  "data": {"image": "car1.jpg"},
  "annotations": [
    {
      "result": [
        {"type": "rectanglelabels", "value": {...}},  // detection
        {"type": "polygonlabels", "value": {...}},    // segmentation
        {"type": "choices", "value": {...}}           // classification
      ]
    }
  ]
}
```

**Export 시**:
- COCO format → detection만
- CSV → classification만
- Custom → 사용자 정의

**특징**:
- 저장은 통합
- Export는 task별 선택 가능

**시사점**:
- 유연한 Export가 핵심

---

### 7. Roboflow

**방식**: **통합 파일** (COCO 기반)

```json
{
  "images": [...],
  "annotations": [
    {
      "bbox": [...],
      "segmentation": [...],  // optional
      "keypoints": [...]      // optional
    }
  ]
}
```

**특징**:
- COCO format 확장
- 모든 annotation 속성이 optional
- Detection만 있으면 `bbox`만, Segmentation 추가하면 `segmentation` 추가

---

## 통계 정리

| 툴 | 방식 | 이유 |
|---|------|------|
| **COCO** | 통합 (유사 task만) | 표준화, ML 프레임워크 호환 |
| **CVAT** | 통합 | 데이터 일관성, Export 간소화 |
| **LabelMe** | 이미지별 분리 | 소규모 프로젝트, 파일 관리 용이 |
| **Labelbox** | 통합 (NDJSON) | 대규모 처리, Streaming |
| **Supervisely** | 이미지별 분리 | 계층적 구조, 확장성 |
| **Label Studio** | 통합 | 유연한 Export, 다양한 task 지원 |
| **Roboflow** | 통합 (COCO) | ML 파이프라인 통합 |

**결론**:
- **7개 중 5개가 통합 방식** ✅
- 분리 방식은 주로 소규모/특수 케이스

---

## 성능 및 확장성 분석

### 시나리오: 10,000 이미지, 3 Tasks (Detection, Classification, Segmentation)

#### 통합 파일

**파일 크기**:
```
annotations.json: ~60 MB
├── Detection: ~30 MB (bbox 좌표)
├── Classification: ~500 KB (클래스만)
└── Segmentation: ~30 MB (polygon 좌표)
```

**로딩 시간**:
- 전체 로드: ~3-5초
- Streaming/Chunking: ~100ms/chunk (1000 images)

**메모리**:
- 전체 로드: ~80 MB RAM
- Streaming: ~8 MB RAM

**장점**:
- Single I/O operation
- Cache 효율적

**단점**:
- 초기 로딩 느림 (첫 접근 시)

#### 태스크별 분리

**파일 크기**:
```
annotations_detection.json: ~30 MB
annotations_classification.json: ~500 KB
annotations_segmentation.json: ~30 MB
Total: ~60 MB (동일)
```

**로딩 시간**:
- Detection만: ~2초
- Classification만: ~50ms
- 전체: ~5초 (3번의 I/O)

**메모리**:
- Detection만: ~40 MB
- 선택적 로딩 가능 ✅

**단점**:
- Multiple I/O operations (네트워크 비용 증가)
- S3에서 3번 요청 vs 1번 요청

---

### 대규모 확장 시나리오 (1,000,000 이미지)

#### 통합 파일
**문제**:
- 파일 크기: ~6 GB ❌
- 로딩 불가능

**해결책**:
1. **Sharding** (권장)
   ```
   annotations/
   ├── shard_0001.json  (1-10000)
   ├── shard_0002.json  (10001-20000)
   └── ...
   ```

2. **Index 파일**
   ```json
   // index.json
   {
     "img_001": "shard_0001.json:line_42",
     "img_002": "shard_0001.json:line_43"
   }
   ```

3. **Database 기반**
   - PostgreSQL with JSONB
   - MongoDB

#### 태스크별 분리
**문제**:
- 각 파일: ~2 GB
- 여전히 너무 큼

**해결책**:
- 동일하게 Sharding 필요
- Task별 + Shard별 = 복잡도 증가

**결론**:
- 대규모에서는 **어떤 방식이든 Sharding 필요**
- 통합 방식이 Sharding 후에도 관리 간단

---

## 권장사항

### 현재 프로젝트 (mvp-vision-ai-labeler)

#### ✅ **통합 파일 방식 유지 권장**

**이유**:
1. **현재 구조와 일치**
   - DB: 정규화 (테이블 분리)
   - Export: 통합 (DICE format)
   - CVAT와 동일한 패턴 ✅

2. **표준 준수**
   - COCO format 기반
   - ML 프레임워크 호환성

3. **데이터 일관성**
   - 트랜잭션 관리 간단
   - 버전 관리 용이

4. **개발 편의성**
   - 코드 복잡도 낮음
   - 유지보수 쉬움

5. **확장성**
   - 새 task 추가 시 구조 변경 불필요
   - Sharding으로 대규모 대응 가능

---

### 구현 가이드

#### Phase 1: 현재 구조 (Small-Medium Scale)
```
dataset_01/
└── annotations.json  ← 통합 파일
```

**적용 범위**: ~50,000 이미지까지

#### Phase 2: Sharding (Large Scale)
```
dataset_01/
├── annotations/
│   ├── index.json
│   ├── shard_0001.json
│   ├── shard_0002.json
│   └── ...
└── images/
```

**적용 범위**: 50,000+ 이미지

#### Phase 3: Hybrid (Enterprise Scale)
```
dataset_01/
├── annotations/
│   ├── metadata.json  ← 전체 메타데이터
│   ├── index/
│   │   └── image_index.db  ← SQLite index
│   └── shards/
│       ├── 0001.json
│       └── 0002.json
└── images/
```

**적용 범위**: 1,000,000+ 이미지

---

### Task별 분리 파일을 고려할 상황

#### ✅ 분리가 유리한 경우

1. **완전히 독립적인 작업 흐름**
   ```
   Team A: Detection만 6개월 작업
   Team B: Classification만 6개월 작업
   → 절대 교차 없음
   ```

2. **Task별 라이선스가 다른 경우**
   ```
   Detection: MIT License
   Segmentation: Commercial License
   → 법적으로 분리 필요
   ```

3. **Task별 업데이트 주기가 극단적으로 다른 경우**
   ```
   Detection: 매일 업데이트
   Classification: 1년에 한번
   → 불필요한 파일 변경 방지
   ```

4. **외부 도구 호환성이 최우선인 경우**
   ```
   YOLO training: detection만 필요
   → annotations_detection.json만 export
   ```

---

## 최종 결론

### 현재 프로젝트 권장 사항

#### ✅ **통합 파일 방식 유지**

**현재 구현**:
```python
# storage.py:372
key = f"datasets/{dataset_id}/annotations.json"  ✅

# dice_export_service.py:134-146
dice_image = {
    "annotations": [
        _convert_annotation_to_dice(ann, idx)  # 모든 type 통합
        for ann in image_annotations
    ]
}
```

**장점 요약**:
1. ✅ 업계 표준 (COCO, CVAT 등)
2. ✅ 데이터 일관성 보장
3. ✅ 개발/유지보수 간단
4. ✅ ML 파이프라인 호환성
5. ✅ 확장 가능 (Sharding)

**단점 및 대응**:
1. ❌ 대규모 파일 크기 → Sharding으로 해결
2. ❌ Task별 선택 로딩 불가 → Filtering으로 해결

### 구현 체크리스트

- [x] DB는 정규화 (annotation_type별 row 분리) ✅
- [x] Export는 통합 (annotations.json 하나) ✅
- [ ] Pagination API 구현 (향후)
- [ ] Sharding 전략 수립 (50K+ 이미지 시)
- [ ] Index 파일 구현 (대규모 검색용)

---

## 참고 자료

### Standards
- [COCO Format Specification](https://cocodataset.org/#format-data)
- [Pascal VOC Format](http://host.robots.ox.ac.uk/pascal/VOC/)

### Open Source Tools
- [CVAT Architecture](https://github.com/opencv/cvat)
- [Label Studio](https://github.com/heartexlabs/label-studio)
- [Supervisely Format](https://docs.supervise.ly/data-organization/00_ann_format_navi)

### Research Papers
- "A Survey on Deep Learning for Image Annotation" (2020)
- "Scalable Data Management for Computer Vision" (2019)

---

**작성일**: 2025-01-18
**버전**: 1.0
**작성자**: Vision AI Labeler Team
