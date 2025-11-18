# Task Context Architecture

## 핵심 개념: "Task = Complete Context"

레이블러는 **한 번에 하나의 task context**에서만 작업합니다.

---

## 🎯 설계 원칙

### 원칙 1: 완전한 Task 격리

```
Classification Mode:
├── Tools: Class selector only
├── Image Status: Classification progress only
├── Classes: Classification classes only
├── Versions: Classification versions only
└── Annotations: Classification annotations only

Detection Mode:
├── Tools: BBox tools only
├── Image Status: Detection progress only
├── Classes: Detection classes only
├── Versions: Detection versions only
└── Annotations: Detection annotations only
```

**다른 task의 정보는 완전히 보이지 않음**

---

### 원칙 2: Task 전환 = Context 전환

```
User clicks [Classification] badge dropdown → Select [Detection]
         ↓
┌─────────────────────────────────────────────────────┐
│ COMPLETE CONTEXT SWITCH                              │
├─────────────────────────────────────────────────────┤
│ 1. Active task: "classification" → "detection"      │
│ 2. Tools: Class selector → BBox tools                │
│ 3. Image status: Reset to "not-started"             │
│ 4. Classes: Classification classes → Detection classes │
│ 5. Versions: Classification versions → Detection versions │
│ 6. Canvas: Clear → Reload detection annotations     │
└─────────────────────────────────────────────────────┘
```

---

### 원칙 3: Task별 독립 버전

```
Project "Cars" has 2 tasks:
├── Classification
│   ├── v1.0 (100 images)
│   ├── v1.1 (120 images)
│   └── v2.0 (150 images)
└── Detection
    ├── v1.0 (50 images)
    └── v1.1 (80 images)
```

Publish in Classification mode → Only Classification version increments

---

## 📊 데이터 구조

### 1. Project 스키마 변경

```python
# 현재
class AnnotationProject:
    task_types = ["classification", "detection"]  # List
    classes = {"cls_1": {...}, "cls_2": {...}}    # Single dict

# 변경 후
class AnnotationProject:
    task_types = ["classification", "detection"]  # List (available tasks)

    # Task별 클래스 분리
    task_classes = {
        "classification": {
            "cls_1": {"name": "Vehicle", "color": "#ff0000"},
            "cls_2": {"name": "Road", "color": "#00ff00"}
        },
        "detection": {
            "det_1": {"name": "Car", "color": "#ff0000"},
            "det_2": {"name": "Truck", "color": "#00ff00"},
            "det_3": {"name": "Bus", "color": "#0000ff"}
        }
    }
```

---

### 2. Version 스키마 변경

```python
# 현재
class AnnotationVersion:
    project_id = "proj_123"
    version_number = "v1.0"
    export_format = "dice"

# 변경 후
class AnnotationVersion:
    project_id = "proj_123"
    task_type = "classification"  # ← 추가!
    version_number = "v1.0"
    export_format = "dice"

# 인덱스 변경
# BEFORE: (project_id, version_number) UNIQUE
# AFTER:  (project_id, task_type, version_number) UNIQUE
```

**버전 예시**:
```sql
project_id | task_type       | version_number
proj_123   | classification  | v1.0
proj_123   | classification  | v1.1
proj_123   | detection       | v1.0
proj_123   | detection       | v1.1
proj_123   | detection       | v2.0
```

---

### 3. Image Status - Task별 분리

```python
# image_task_status 테이블 (기존 확장)
class ImageTaskStatus:
    project_id = "proj_123"
    image_id = "car1.jpg"
    task_type = "classification"  # Task 구분
    status = "completed"
    annotation_count = 1
```

**데이터 예시**:
```sql
project_id | image_id  | task_type       | status       | annotation_count
proj_123   | car1.jpg  | classification  | completed    | 1
proj_123   | car1.jpg  | detection       | not-started  | 0
proj_123   | car2.jpg  | classification  | not-started  | 0
proj_123   | car2.jpg  | detection       | in-progress  | 2
```

---

## 🎨 UI 구현

### 1. TopBar - Task Switcher

```tsx
// TopBar.tsx
<div className="flex items-center gap-2">
  <span className="text-sm font-medium text-gray-900 dark:text-white">
    {project?.name}
  </span>

  {/* Task Switcher Dropdown */}
  <div className="relative">
    <button
      onClick={() => setTaskDropdownOpen(!taskDropdownOpen)}
      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
    >
      <TaskIcon type={currentTask} className="w-4 h-4" />
      {getTaskLabel(currentTask)}
      <ChevronDownIcon className="w-4 h-4" />
    </button>

    {/* Dropdown */}
    {taskDropdownOpen && (
      <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50">
        {/* Current Task */}
        <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
          Current Task
        </div>
        <div className="px-3 py-2 bg-violet-50 dark:bg-violet-900/20">
          <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
            <TaskIcon type={currentTask} className="w-4 h-4" />
            <span className="font-medium">{getTaskLabel(currentTask)}</span>
            <CheckIcon className="w-4 h-4 ml-auto" />
          </div>
        </div>

        {/* Available Tasks */}
        <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
            Switch to...
          </div>
          {availableTasks
            .filter(task => task !== currentTask)
            .map(task => (
              <button
                key={task}
                onClick={() => switchTask(task)}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <TaskIcon type={task} className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {getTaskLabel(task)}
                  </span>
                </div>
              </button>
            ))}
        </div>

        {/* Manage Tasks */}
        <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
          <button
            onClick={() => {
              setTaskDropdownOpen(false);
              setTaskManagementOpen(true);
            }}
            className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <PlusCircleIcon className="w-4 h-4" />
              <span>Manage Tasks...</span>
            </div>
          </button>
        </div>
      </div>
    )}
  </div>
</div>
```

**동작**:
1. 배지 클릭 → 드롭다운 열림
2. 현재 task: 체크 표시
3. 다른 task: 클릭하면 전환
4. "Manage Tasks...": Task 추가/삭제 모달

---

### 2. Task 전환 로직

```typescript
// useAnnotationStore.ts
interface AnnotationStore {
  currentTask: string;  // 현재 활성 task
  project: Project;
  images: Image[];
  annotations: Annotation[];

  switchTask: (newTask: string) => Promise<void>;
}

const switchTask = async (newTask: string) => {
  // 1. Confirmation dialog
  const hasUnsaved = checkUnsavedChanges();
  if (hasUnsaved) {
    const confirmed = await confirm(
      'You have unsaved changes. Switch task anyway?'
    );
    if (!confirmed) return;
  }

  // 2. Save current state
  await saveCurrentAnnotations();

  // 3. Switch task context
  set({ currentTask: newTask });

  // 4. Reset UI state
  set({
    currentIndex: 0,  // 첫 이미지로
    selectedAnnotationId: null,
    tool: 'select',
  });

  // 5. Reload task-specific data
  await loadTaskData(newTask);
};

const loadTaskData = async (task: string) => {
  const projectId = get().project.id;

  // Load annotations for this task
  const annotations = await getProjectAnnotations(projectId, {
    task_type: task
  });

  // Load image statuses for this task
  const imageStatuses = await getImageTaskStatuses(projectId, task);

  // Update store
  set({
    annotations,
    imageStatuses
  });
};
```

---

### 3. Canvas - Task별 도구

```tsx
// Canvas.tsx
export default function Canvas() {
  const { currentTask } = useAnnotationStore();

  return (
    <div className="canvas-container">
      {/* Task-specific toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-lg p-2">
        {currentTask === 'bbox' && (
          <>
            <ToolButton icon={<SelectIcon />} tool="select" label="Select" />
            <ToolButton icon={<BBoxIcon />} tool="bbox" label="BBox" />
          </>
        )}

        {currentTask === 'classification' && (
          <ClassificationPanel />
        )}

        {currentTask === 'polygon' && (
          <>
            <ToolButton icon={<SelectIcon />} tool="select" label="Select" />
            <ToolButton icon={<PolygonIcon />} tool="polygon" label="Polygon" />
          </>
        )}

        {currentTask === 'keypoint' && (
          <>
            <ToolButton icon={<SelectIcon />} tool="select" label="Select" />
            <ToolButton icon={<KeypointIcon />} tool="keypoint" label="Keypoint" />
          </>
        )}
      </div>

      <canvas ref={canvasRef} />

      {/* Task-specific annotation rendering */}
      {currentTask === 'bbox' && renderBBoxAnnotations()}
      {currentTask === 'polygon' && renderPolygonAnnotations()}
      {currentTask === 'keypoint' && renderKeypointAnnotations()}
      {/* Classification has no canvas overlay */}
    </div>
  );
}
```

---

### 4. ImageList - Task별 상태

```tsx
// ImageList.tsx
const getImageStatus = (image: Image) => {
  const { currentTask, imageStatuses } = useAnnotationStore();

  // 현재 task의 상태만 확인
  const taskStatus = imageStatuses.find(
    s => s.image_id === image.id && s.task_type === currentTask
  );

  return taskStatus?.status || 'not-started';
};

// UI
<div className="image-item">
  <img src={image.url} />
  <span className="filename">{image.file_name}</span>

  {/* Current task status only */}
  <span className={`status-badge ${getImageStatus(image)}`}>
    {getStatusLabel(getImageStatus(image))}
  </span>

  {/* No other task statuses visible */}
</div>
```

---

### 5. RightPanel - Task별 클래스

```tsx
// RightPanel.tsx
const getCurrentClasses = () => {
  const { project, currentTask } = useAnnotationStore();

  // Task별 클래스 반환
  return project.task_classes?.[currentTask] || {};
};

// UI
<div className="class-list">
  <h4 className="font-semibold mb-2">
    Classes ({currentTask})
  </h4>

  {Object.entries(getCurrentClasses()).map(([classId, classInfo]) => (
    <div key={classId} className="class-item">
      <div className="color-box" style={{ backgroundColor: classInfo.color }} />
      <span className="class-name">{classInfo.name}</span>
      <span className="class-count">{getClassCount(classId)}</span>
    </div>
  ))}

  <button onClick={() => openClassManagement(currentTask)}>
    + Add Class
  </button>
</div>
```

---

### 6. AnnotationHistory - Task별 버전

```tsx
// AnnotationHistory.tsx
const loadVersions = useCallback(async () => {
  const { project, currentTask } = useAnnotationStore();

  if (!project?.id) return;

  try {
    // Task별 버전만 로드
    const result = await listVersions(project.id, {
      task_type: currentTask  // ← 필터링
    });

    const publishedVersions = result.versions
      .filter(v => v.version_type === 'published')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3);

    setVersions(publishedVersions);
  } catch (error) {
    console.error('Failed to load versions:', error);
  }
}, [project?.id, currentTask]);  // currentTask 의존성 추가!
```

---

## 🔄 Task 전환 시나리오

### 시나리오: Classification → Detection 전환

```
Initial State (Classification Mode):
├── TopBar: [Classification ▼]
├── Canvas: Class selector visible
├── ImageList: car1.jpg (✓ completed), car2.jpg (○ not-started)
├── Classes: Vehicle, Road, Building
└── Versions: v1.0, v1.1

User: Clicks [Classification ▼] → Selects "Detection"
         ↓
┌─────────────────────────────────────────────────┐
│ Task Switch Process                              │
├─────────────────────────────────────────────────┤
│ 1. Confirm: "Save current changes?"             │
│ 2. Save classification annotations              │
│ 3. Set currentTask = "detection"                │
│ 4. Clear canvas                                 │
│ 5. Load detection annotations                   │
│ 6. Load detection image statuses                │
│ 7. Update classes to detection classes          │
│ 8. Update versions to detection versions        │
│ 9. Reset to first image                         │
└─────────────────────────────────────────────────┘
         ↓
New State (Detection Mode):
├── TopBar: [Detection ▼]
├── Canvas: BBox tools visible
├── ImageList: car1.jpg (○ not-started), car2.jpg (○ not-started)  ← Reset!
├── Classes: Car, Truck, Bus  ← Different!
└── Versions: v1.0  ← Different!
```

---

## 📋 API 변경사항

### 1. List Versions - Task 필터 추가

```typescript
// GET /api/v1/projects/{project_id}/versions?task_type=classification

interface ListVersionsRequest {
  task_type?: string;  // ← 추가
}

interface VersionResponse {
  id: number;
  project_id: string;
  task_type: string;  // ← 추가
  version_number: string;
  created_at: string;
  // ...
}
```

---

### 2. Get Annotations - Task 필터 추가

```typescript
// GET /api/v1/projects/{project_id}/annotations?task_type=detection

interface GetAnnotationsRequest {
  task_type?: string;  // ← 추가
  include_draft?: boolean;
}
```

---

### 3. Get Image Statuses - Task 필터 추가

```typescript
// GET /api/v1/projects/{project_id}/images/status?task_type=classification

interface ImageStatusResponse {
  image_id: string;
  task_type: string;  // ← 추가
  status: string;
  annotation_count: number;
}
```

---

### 4. Publish Version - Task 명시

```typescript
// POST /api/v1/projects/{project_id}/versions/publish

interface PublishVersionRequest {
  task_type: string;  // ← 필수!
  export_format: 'dice' | 'coco' | 'yolo';
  include_draft: boolean;
  description?: string;
}
```

---

### 5. Update Project - Task별 클래스

```typescript
// PATCH /api/v1/projects/{project_id}

interface UpdateProjectRequest {
  task_classes?: {
    [task_type: string]: {
      [class_id: string]: ClassInfo;
    };
  };
}

// Example
{
  "task_classes": {
    "classification": {
      "cls_1": {"name": "Vehicle", "color": "#ff0000"}
    },
    "detection": {
      "det_1": {"name": "Car", "color": "#ff0000"},
      "det_2": {"name": "Truck", "color": "#00ff00"}
    }
  }
}
```

---

## 🎯 장단점 분석

### 장점 ✅

1. **UI 명확성**
   - 한 번에 하나의 task만 → 혼란 없음
   - 모든 UI가 현재 task에만 집중

2. **인지 부하 최소화**
   - 다른 task 정보가 안 보임 → 집중 가능
   - Task 전환은 명시적 행동 필요

3. **독립적 버전 관리**
   - Task별 진행도 관리 가능
   - Classification v2.0, Detection v1.0 가능

4. **데이터 일관성**
   - Task별로 완전히 분리된 데이터
   - Cross-task 충돌 없음

---

### 단점 ❌

1. **같은 이미지 반복 작업**
   - car1.jpg를 Classification에서 한번, Detection에서 또 한번
   - 작업 효율 저하 가능

2. **Cross-task 정보 확인 어려움**
   - Detection 작업 중 "이 이미지 Classification이 뭐였더라?" 확인 불가
   - Task 전환해야 확인 가능

3. **Task 전환 오버헤드**
   - Context 전환에 시간 소요
   - 데이터 reload 필요

4. **복잡한 데이터 구조**
   - Task별로 클래스, 버전, 상태 분리
   - 관리 복잡도 증가

---

### 완화 방안

**단점 1 해결**: Batch operation
```typescript
// 같은 이미지 100개를 모두 Classification 먼저 작업
// 그 다음 Task 전환 → Detection 작업
```

**단점 2 해결**: Quick preview
```typescript
// Modal: "View other task annotations"
// 읽기 전용으로 다른 task의 annotation 확인
```

**단점 3 해결**: Lazy loading
```typescript
// Task 전환 시 현재 이미지 데이터만 먼저 로드
// 나머지는 백그라운드 로딩
```

---

## 🚀 구현 순서

### Phase 1: Core Infrastructure

1. **DB 마이그레이션**
   - [ ] `task_classes` 필드 추가 (AnnotationProject)
   - [ ] `task_type` 컬럼 추가 (AnnotationVersion)
   - [ ] Index 변경: `(project_id, task_type, version_number)` UNIQUE
   - [ ] 기존 데이터 마이그레이션 스크립트

2. **Store 업데이트**
   - [ ] `currentTask` state 추가
   - [ ] `switchTask()` 함수 구현
   - [ ] Task별 데이터 로딩 로직

---

### Phase 2: UI Components

3. **TopBar - Task Switcher**
   - [ ] 드롭다운 버튼 구현
   - [ ] Task 목록 표시
   - [ ] Task 전환 로직 연결

4. **Canvas - Task별 도구**
   - [ ] Task별 toolbar 분기
   - [ ] Task별 annotation rendering

5. **ImageList - Task별 상태**
   - [ ] Task 필터링 적용
   - [ ] 상태 표시 업데이트

6. **RightPanel - Task별 클래스**
   - [ ] Task별 클래스 로딩
   - [ ] 클래스 추가/삭제 (task 컨텍스트)

7. **AnnotationHistory - Task별 버전**
   - [ ] Task 필터링 적용
   - [ ] 버전 목록 업데이트

---

### Phase 3: API Updates

8. **Backend API**
   - [ ] GET `/versions` - task_type 파라미터 추가
   - [ ] GET `/annotations` - task_type 파라미터 추가
   - [ ] GET `/images/status` - task_type 파라미터 추가
   - [ ] POST `/versions/publish` - task_type 필수 필드 추가
   - [ ] PATCH `/projects/{id}` - task_classes 업데이트

9. **Export Service**
   - [ ] Task별 export 로직
   - [ ] Task별 파일명: `annotations_classification.json`, `annotations_detection.json`

---

### Phase 4: Polish & Test

10. **UX 개선**
    - [ ] Task 전환 시 confirmation dialog
    - [ ] Unsaved changes warning
    - [ ] Loading states
    - [ ] Error handling

11. **테스트**
    - [ ] Task 전환 시나리오 테스트
    - [ ] 데이터 일관성 테스트
    - [ ] 버전 publish 테스트

---

## 📝 마이그레이션 가이드

### 기존 프로젝트 데이터 마이그레이션

```python
# Migration script
def migrate_single_to_multi_task():
    projects = db.query(AnnotationProject).all()

    for project in projects:
        # 1. 기존 classes를 첫 번째 task의 클래스로 변환
        first_task = project.task_types[0] if project.task_types else 'classification'

        project.task_classes = {
            first_task: project.classes  # 기존 classes 이동
        }

        # 2. 기존 버전에 task_type 추가
        versions = db.query(AnnotationVersion).filter(
            AnnotationVersion.project_id == project.id
        ).all()

        for version in versions:
            version.task_type = first_task  # 첫 번째 task로 할당

        db.commit()
```

---

## ✅ 결론

이 아키텍처는:
- ✅ **명확성을 최우선**으로 한 설계
- ✅ **완전한 Task 격리**로 혼란 제거
- ✅ **독립적인 버전 관리**로 유연성 확보

**Trade-off**: 효율성 < 명확성

하지만 Labeling의 핵심은 **정확성**이므로, 명확한 UI가 더 중요합니다.

---

**작성일**: 2025-01-18
**버전**: 1.0
**작성자**: Vision AI Labeler Team
