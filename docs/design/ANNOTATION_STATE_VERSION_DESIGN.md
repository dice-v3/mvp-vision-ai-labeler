# Annotation State & Version Management Design

**작성일**: 2025-11-14
**상태**: Draft - Review Required

---

## 1. 문제 정의

### 1.1 현재 이슈
- Image 상태 (not-started, in-progress, completed)가 단순 annotation count로만 판단됨
- Annotation 삭제 후 count가 0이 되면 'not-started'로 표시되는 문제
- 작업 이력(history)이 추적되지 않음
- Confirm(확정) 메커니즘이 없음
- Version 관리 전략이 없음

### 1.2 요구사항
1. **Image 상태를 정확히 추적**
   - 한 번도 작업하지 않은 이미지 vs 작업했다가 모두 삭제한 이미지를 구분
   - 컨펌된 annotation이 있는 이미지 vs 작업 중인 이미지를 구분

2. **Annotation 확정 기능**
   - 사용자가 현재 작업을 "확정"할 수 있어야 함
   - 확정된 annotation과 작업 중인 annotation을 구분

3. **합리적인 버전 관리**
   - 이미지 1장 컨펌할 때마다 버전 증가 X
   - 의미 있는 작업 단위로 버전 관리
   - Export/Publish 시점에 버전 확정

---

## 2. 핵심 개념 정의

### 2.1 Image Status (이미지 상태)

**3가지 상태**:

```typescript
type ImageStatus = 'not-started' | 'in-progress' | 'completed';
```

**상태 정의**:

| 상태 | 설명 | 조건 |
|------|------|------|
| **not-started** | 한 번도 작업하지 않음 | `last_modified_at IS NULL` |
| **in-progress** | 작업 중 | `last_modified_at IS NOT NULL` AND NOT all annotations confirmed |
| **completed** | 작업 완료 | All annotations confirmed AND `is_image_confirmed = true` |

**핵심**: `last_modified_at` 타임스탬프로 "작업 이력"을 추적

### 2.2 Annotation Lifecycle (어노테이션 생명주기)

```
┌─────────┐
│  Draft  │ ← 새로 생성, 수정 중
└────┬────┘
     │ User confirms annotation
     ↓
┌───────────┐
│ Confirmed │ ← 사용자 확정
└─────┬─────┘
      │ (Optional) Reviewer verifies
      ↓
┌──────────┐
│ Verified │ ← 검수자 검증 (추후 기능)
└──────────┘
```

**Annotation State**:

```typescript
type AnnotationState = 'draft' | 'confirmed' | 'verified';
```

| 상태 | 설명 | 사용자 액션 |
|------|------|------------|
| **draft** | 작업 중 | 자동 저장 또는 수동 저장 |
| **confirmed** | 사용자 확정 | "Confirm" 버튼 클릭 |
| **verified** | 검수 완료 | 리뷰어가 "Verify" 클릭 (Phase 2+) |

### 2.3 Version Management (버전 관리)

**2-Level Versioning**:

1. **Working Version (작업 버전)** - 실시간 auto-save
2. **Published Version (발행 버전)** - 명시적 export/publish

```
Working Version (v0.1, v0.2, ...) → User clicks "Publish" → Published Version (v1.0)
```

**버전 증가 시점**:

| 액션 | Working Version | Published Version |
|------|-----------------|-------------------|
| Auto-save annotation | 증가 안함 | 증가 안함 |
| Confirm annotation | 증가 안함 | 증가 안함 |
| Complete session (여러 이미지 작업 후) | Minor 증가 (+0.1) | 증가 안함 |
| Export/Publish | - | Major 증가 (+1.0) |

**예시**:
- 100장 작업 중 → auto-save → working v0.1
- 50장 완료 후 세션 종료 → working v0.2
- 나머지 50장 완료 → working v0.3
- "Export Annotations" 클릭 → **v1.0 발행**

---

## 3. 데이터베이스 스키마 변경

### 3.1 ImageAnnotationStatus 테이블 (새로 추가)

```sql
CREATE TABLE image_annotation_status (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  image_id INTEGER NOT NULL REFERENCES dataset_images(id) ON DELETE CASCADE,

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'not-started',  -- not-started | in-progress | completed
  first_modified_at TIMESTAMP,  -- 처음 작업 시작 시각
  last_modified_at TIMESTAMP,   -- 마지막 수정 시각
  confirmed_at TIMESTAMP,       -- 이미지 컨펌 시각

  -- Annotation counts
  total_annotations INTEGER DEFAULT 0,
  confirmed_annotations INTEGER DEFAULT 0,
  draft_annotations INTEGER DEFAULT 0,

  -- Flags
  is_image_confirmed BOOLEAN DEFAULT FALSE,  -- 이미지 전체 컨펌 여부

  UNIQUE(project_id, image_id),
  INDEX idx_project_status (project_id, status)
);
```

### 3.2 Annotations 테이블 변경

```sql
ALTER TABLE annotations ADD COLUMN annotation_state VARCHAR(20) DEFAULT 'draft';
-- Values: 'draft' | 'confirmed' | 'verified'

ALTER TABLE annotations ADD COLUMN confirmed_at TIMESTAMP;
ALTER TABLE annotations ADD COLUMN confirmed_by INTEGER REFERENCES users(id);

ALTER TABLE annotations ADD INDEX idx_annotation_state (annotation_state);
```

### 3.3 AnnotationVersions 테이블 (새로 추가)

```sql
CREATE TABLE annotation_versions (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Version info
  version_number VARCHAR(20) NOT NULL,  -- "v1.0", "v1.1", etc.
  version_type VARCHAR(20) NOT NULL,    -- 'working' | 'published'

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  description TEXT,

  -- Snapshot
  annotation_count INTEGER,
  image_count INTEGER,

  -- Export info (for published versions)
  export_format VARCHAR(20),  -- 'coco' | 'yolo' | 'voc'
  export_path TEXT,

  UNIQUE(project_id, version_number),
  INDEX idx_project_version (project_id, version_type)
);
```

### 3.4 AnnotationSnapshots 테이블 (새로 추가)

버전별 annotation 스냅샷 (불변 기록)

```sql
CREATE TABLE annotation_snapshots (
  id SERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES annotation_versions(id) ON DELETE CASCADE,
  annotation_id INTEGER NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,

  -- Snapshot data (JSON)
  snapshot_data JSONB NOT NULL,

  INDEX idx_version (version_id),
  INDEX idx_annotation (annotation_id)
);
```

---

## 4. 상태 전이 규칙 (State Transition Rules)

### 4.1 Image Status Transitions

```
┌─────────────┐
│ Not Started │
└──────┬──────┘
       │ First annotation created
       ↓
┌─────────────┐
│ In Progress │ ←──────────┐
└──────┬──────┘            │
       │                   │
       │ Confirm image     │ Unconfirm or modify
       ↓                   │
┌─────────────┐            │
│  Completed  │────────────┘
└─────────────┘
```

**전이 조건**:

| From | To | Trigger | DB Update |
|------|----|---------|-----------|
| not-started | in-progress | Create first annotation | `first_modified_at = NOW()`, `last_modified_at = NOW()` |
| in-progress | in-progress | Create/Update/Delete annotation | `last_modified_at = NOW()` |
| in-progress | completed | Confirm all annotations + Confirm image | `confirmed_at = NOW()`, `is_image_confirmed = TRUE` |
| completed | in-progress | Unconfirm image OR create/modify annotation | `is_image_confirmed = FALSE`, `last_modified_at = NOW()` |

### 4.2 Annotation State Transitions

```
┌───────┐
│ Draft │ ←──────────┐
└───┬───┘            │
    │                │
    │ Confirm        │ Unconfirm
    ↓                │
┌───────────┐        │
│ Confirmed │────────┘
└─────┬─────┘
      │ (Future: Verify)
      ↓
┌──────────┐
│ Verified │
└──────────┘
```

---

## 5. UI/UX 설계

### 5.1 Image Confirmation Flow

**사용자 워크플로우**:

1. **이미지에 annotation 작업**
   - Bbox 그리기 → Class 선택 → Auto-save (draft)
   - 상태: `in-progress`

2. **작업 완료 후 "Confirm Image" 버튼 클릭**
   - 모든 draft annotations를 confirmed로 변경
   - Image status를 `completed`로 변경
   - UI: ✓ Complete 배지 표시

3. **다음 이미지로 이동**
   - 키보드: → 또는 D
   - 자동으로 다음 not-started 이미지로 이동 (옵션)

**UI 컴포넌트**:

```
┌──────────────────────────────────┐
│ TopBar                            │
│  ┌────────────────────────────┐  │
│  │ [✓ Confirm Image]           │  │ ← Phase 1
│  └────────────────────────────┘  │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Canvas Bottom Controls            │
│  ┌──────┐  ┌───────────┐  ┌────┐│
│  │ Zoom  │  │ < 1/100 > │  │ AI ││
│  └──────┘  └───────────┘  └────┘│
│                                   │
│  [✓ Confirm & Next (Ctrl+Enter)] │ ← New button
└──────────────────────────────────┘
```

### 5.2 Annotation Confirmation (Individual)

**개별 annotation 확정**:

```
┌─────────────────────────────────────┐
│ RightPanel - Annotations (3)        │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🟦 Person  [✓] [👁] [🗑]      │ │ ← Confirmed
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🟩 Car (draft) [✓] [👁] [🗑]   │ │ ← Draft
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**버튼**:
- `[✓]`: Confirm/Unconfirm annotation
- `[👁]`: Show/Hide
- `[🗑]`: Delete

### 5.3 Bulk Confirmation

**BottomBar (또는 RightPanel)**:

```
┌─────────────────────────────────────┐
│ Bulk Actions                         │
│  [Confirm All (3)]  [Clear All]      │
└─────────────────────────────────────┘
```

### 5.4 Version Management UI (Phase 2)

**Project Dashboard**:

```
┌────────────────────────────────────────┐
│ Annotation Versions                     │
├────────────────────────────────────────┤
│ Working: v0.3 (50 images, 423 annot.)  │
│                                         │
│ Published Versions:                     │
│ • v1.0 - 2025-11-10 (100 images)       │
│ • v0.9 - 2025-11-05 (80 images)        │
│                                         │
│ [📤 Publish New Version]                │
└────────────────────────────────────────┘
```

---

## 6. API 설계

### 6.1 Image Status APIs

**GET /api/v1/projects/{projectId}/images/status**

Response:
```json
{
  "images": [
    {
      "image_id": 123,
      "status": "in-progress",
      "first_modified_at": "2025-11-14T10:00:00Z",
      "last_modified_at": "2025-11-14T11:30:00Z",
      "total_annotations": 5,
      "confirmed_annotations": 3,
      "draft_annotations": 2,
      "is_image_confirmed": false
    }
  ]
}
```

### 6.2 Annotation Confirmation APIs

**POST /api/v1/annotations/{annotationId}/confirm**

Confirms a single annotation.

Request:
```json
{
  "confirmed": true  // or false to unconfirm
}
```

Response:
```json
{
  "id": 456,
  "annotation_state": "confirmed",
  "confirmed_at": "2025-11-14T12:00:00Z",
  "confirmed_by": 1
}
```

**POST /api/v1/images/{imageId}/confirm**

Confirms all annotations on an image and marks image as completed.

Request:
```json
{
  "project_id": 10
}
```

Response:
```json
{
  "image_id": 123,
  "status": "completed",
  "confirmed_annotations": 5,
  "confirmed_at": "2025-11-14T12:05:00Z"
}
```

**POST /api/v1/projects/{projectId}/annotations/bulk-confirm**

Bulk confirm annotations.

Request:
```json
{
  "annotation_ids": [456, 457, 458]
}
```

Response:
```json
{
  "confirmed_count": 3,
  "failed_ids": []
}
```

### 6.3 Version Management APIs (Phase 2)

**GET /api/v1/projects/{projectId}/versions**

List all versions.

**POST /api/v1/projects/{projectId}/versions/publish**

Publish new version.

Request:
```json
{
  "version_number": "v1.0",
  "description": "Initial release with 100 images",
  "export_format": "coco"
}
```

Response:
```json
{
  "version_id": 5,
  "version_number": "v1.0",
  "annotation_count": 523,
  "image_count": 100,
  "export_path": "s3://exports/project-10/v1.0/annotations.json"
}
```

---

## 7. 구현 전략

### 7.1 Phase 1: Image & Annotation Confirmation (Week 2)

**목표**: Confirm 기능 구현, Image status 정확히 추적

**Tasks**:
1. ✅ DB Migration: `image_annotation_status` 테이블 추가
2. ✅ DB Migration: `annotations.annotation_state` 컬럼 추가
3. ✅ Backend API: Annotation confirm/unconfirm
4. ✅ Backend API: Image confirm
5. ✅ Backend API: Image status 계산 및 반환
6. ✅ Frontend: "Confirm Image" 버튼 (TopBar 또는 Canvas)
7. ✅ Frontend: Individual annotation confirm toggle (RightPanel)
8. ✅ Frontend: Bulk confirm annotations
9. ✅ Frontend: Image status badges (✓ Complete, ⚠ In Progress)
10. ✅ Frontend: Filter by status (실제 동작하도록 수정)

**Estimated**: 12 hours

### 7.2 Phase 2: Version Management (Week 3-4)

**목표**: Working version과 Published version 구분

**Tasks**:
1. DB Migration: `annotation_versions` 테이블 추가
2. DB Migration: `annotation_snapshots` 테이블 추가
3. Backend: Auto-increment working version
4. Backend: Publish version API
5. Backend: Version snapshot 생성
6. Frontend: Version history UI (Project Dashboard)
7. Frontend: "Publish Version" modal
8. Frontend: Export annotations by version

**Estimated**: 16 hours

### 7.3 Phase 3: Review & Verification (Future)

**목표**: 검수자 워크플로우 (annotation verification)

- Verified state 추가
- Reviewer 권한 추가
- Review queue UI
- Approval workflow

---

## 8. 예시 시나리오

### Scenario 1: 기본 작업 흐름

1. **User opens image #1 (not-started)**
   - Image status: `not-started`
   - Annotations: []

2. **User draws 3 bboxes**
   - Auto-save → All annotations: `draft`
   - Image status: `in-progress`
   - `last_modified_at` updated

3. **User clicks "Confirm Image"**
   - All annotations: `draft` → `confirmed`
   - Image status: `completed`
   - `confirmed_at` set

4. **User navigates to image #2**
   - Auto-navigate to next not-started image

### Scenario 2: 수정 후 재확정

1. **User opens completed image #5**
   - Image status: `completed`
   - Annotations: 5 (all confirmed)

2. **User adds 1 new bbox**
   - New annotation: `draft`
   - Image status: `completed` → `in-progress` (자동 전환)
   - `last_modified_at` updated

3. **User confirms new annotation**
   - New annotation: `draft` → `confirmed`

4. **User clicks "Confirm Image" again**
   - Image status: `in-progress` → `completed`

### Scenario 3: 삭제 후 상태

1. **User opens in-progress image #10**
   - Image status: `in-progress`
   - Annotations: 2 (draft)

2. **User deletes all annotations**
   - Annotations: [] (empty)
   - Image status: `in-progress` (여전히!)
   - `last_modified_at` updated
   - **NOT** `not-started` (작업 이력 있음)

3. **Filter: "Not Started"**
   - Image #10 표시 안됨 (정상)

### Scenario 4: 버전 발행

1. **User works on 100 images**
   - 50 images: completed
   - 30 images: in-progress
   - 20 images: not-started

2. **User clicks "Publish Version"**
   - Modal: "Publish v1.0?"
   - Warning: "30 images are in-progress. Publish anyway?"
   - User confirms

3. **System creates v1.0**
   - Snapshot all 523 annotations
   - Export to COCO format
   - Store in `annotation_versions`
   - Working version: v0.1 → v0.2

---

## 9. 기술적 고려사항

### 9.1 Performance

**문제**: 매 annotation 저장 시 `image_annotation_status` 업데이트 필요

**해결**:
- Debounce: 3초 내 여러 변경 → 1번만 업데이트
- Batch update: 여러 이미지 작업 시 bulk update
- Cache: Frontend에서 status 캐싱

### 9.2 Consistency

**문제**: Annotation 삭제 후 count mismatch

**해결**:
- Database trigger로 자동 count 동기화
- 또는 Periodic sync job (매 1분)

```sql
CREATE OR REPLACE FUNCTION update_image_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE image_annotation_status
  SET
    total_annotations = (
      SELECT COUNT(*) FROM annotations
      WHERE image_id = NEW.image_id AND project_id = NEW.project_id
    ),
    confirmed_annotations = (
      SELECT COUNT(*) FROM annotations
      WHERE image_id = NEW.image_id AND project_id = NEW.project_id
      AND annotation_state = 'confirmed'
    ),
    last_modified_at = NOW()
  WHERE image_id = NEW.image_id AND project_id = NEW.project_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER annotation_status_update
AFTER INSERT OR UPDATE OR DELETE ON annotations
FOR EACH ROW EXECUTE FUNCTION update_image_status();
```

### 9.3 Conflict Resolution

**문제**: 여러 사용자가 동시에 같은 이미지 작업

**해결** (Phase 3):
- Optimistic locking: `version` 컬럼 추가
- Last-write-wins: 최근 수정이 우선
- Conflict modal: 사용자에게 선택권

---

## 10. Migration Plan

### 10.1 기존 데이터 마이그레이션

**기존 annotations 테이블 데이터 처리**:

```sql
-- Step 1: Add new columns
ALTER TABLE annotations ADD COLUMN annotation_state VARCHAR(20) DEFAULT 'draft';

-- Step 2: Migrate existing data (모두 confirmed로 간주)
UPDATE annotations SET annotation_state = 'confirmed';

-- Step 3: Create image_annotation_status
INSERT INTO image_annotation_status (project_id, image_id, status, total_annotations, confirmed_annotations, last_modified_at)
SELECT
  a.project_id,
  a.image_id,
  CASE
    WHEN COUNT(*) > 0 THEN 'completed'
    ELSE 'not-started'
  END as status,
  COUNT(*) as total_annotations,
  COUNT(*) as confirmed_annotations,
  MAX(a.updated_at) as last_modified_at
FROM annotations a
GROUP BY a.project_id, a.image_id;
```

### 10.2 Rollback Plan

- DB Snapshot 생성
- Migration script의 DOWN 버전 준비
- 테스트 환경에서 먼저 실행

---

## 11. 향후 확장 가능성

### 11.1 Multi-user Collaboration
- Annotation owner tracking
- Lock mechanism (이미지 편집 중 잠금)
- Real-time collaboration (WebSocket)

### 11.2 Advanced Versioning
- Branch & Merge (Git-like)
- Diff view between versions
- Rollback to previous version

### 11.3 Quality Control
- Annotation quality score
- Auto-detection of poor annotations
- Reviewer assignment workflow

---

## 12. Decision Log

### Decision 1: Image Status는 3-state로 충분한가?

**고려한 옵션**:
- 3-state: not-started, in-progress, completed
- 5-state: not-started, draft, submitted, reviewed, completed

**결정**: 3-state 선택
**이유**:
- Phase 1에서는 단순함이 중요
- Reviewed state는 Phase 3 (Verification)에서 추가

### Decision 2: 버전은 언제 증가시킬 것인가?

**고려한 옵션**:
- A) 매 이미지 confirm 시
- B) 매 세션 종료 시
- C) 명시적 Publish 시만

**결정**: C) 명시적 Publish 시만 Major version 증가
**이유**:
- 100장 작업 시 v100까지 증가하는 것은 불합리
- Working version (minor)과 Published version (major) 분리
- 사용자가 의미 있는 시점에 버전 발행

### Decision 3: Draft annotation은 자동 저장할 것인가?

**결정**: YES, 3초 debounce로 auto-save
**이유**:
- 사용자 실수로 작업 손실 방지
- Modern annotation tool의 표준 기능

---

## 13. Review Questions

이 설계에 대해 검토가 필요한 질문들:

1. **Image status가 3가지로 충분한가?**
   - "Submitted" (제출됨, 검수 대기) 상태가 필요한가?

2. **Annotation 개별 confirm이 필요한가?**
   - 또는 이미지 단위로만 confirm하면 충분한가?

3. **Working version 증가 전략**
   - 세션 종료 시? 수동? 시간 기반?

4. **Multi-user 시나리오**
   - 같은 이미지를 여러 사람이 동시 작업 가능한가?
   - Lock 필요한가?

5. **Annotation 삭제 이력 보존**
   - Soft delete vs Hard delete?
   - Audit log 필요한가?

---

## 14. 다음 단계

1. **설계 검토 및 피드백**
   - 이 문서를 팀과 공유
   - 요구사항 검증

2. **DB 스키마 확정**
   - Migration script 작성
   - 테스트 데이터로 검증

3. **Phase 1 구현 시작**
   - Backend API 우선 (2일)
   - Frontend UI (3일)
   - 통합 테스트 (1일)

4. **문서 업데이트**
   - API 문서에 새 엔드포인트 추가
   - User guide 작성

---

**Status**: 🟡 Draft - Awaiting Review
**Next Reviewer**: Product Owner / Tech Lead
**Target Review Date**: 2025-11-15
