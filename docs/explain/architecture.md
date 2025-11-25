# MVP Vision AI Labeler - System Architecture

## 목차
1. [시스템 개요](#시스템-개요)
2. [아키텍쳐 구성 요소](#아키텍쳐-구성-요소)
3. [주요 기술 스택](#주요-기술-스택)
4. [데이터 모델](#데이터-모델)
5. [API 구조](#api-구조)
6. [Frontend 상태 관리](#frontend-상태-관리)
7. [주요 사용자 시나리오](#주요-사용자-시나리오)

---

## 시스템 개요

MVP Vision AI Labeler는 이미지 어노테이션 및 레이블링 작업을 위한 웹 기반 협업 플랫폼입니다.

### 핵심 기능
- 다중 어노테이션 타입 지원 (BBox, Polygon, Polyline, Circle, Classification)
- 실시간 협업 및 충돌 방지 (Image Lock 시스템)
- 5단계 RBAC 권한 시스템 (Owner, Admin, Reviewer, Annotator, Viewer)
- Undo/Redo 기능 (백엔드 동기화)
- 어노테이션 버전 히스토리
- 데이터셋 초대 및 멤버 관리
- Export (COCO, YOLO 등)

### 주요 아키텍쳐 특징
- **3-tier 아키텍쳐**: Frontend (Next.js) - Backend (FastAPI) - Database (PostgreSQL + SQLite)
- **상태 중심 설계**: Zustand를 활용한 클라이언트 상태 관리
- **Canvas 기반 렌더링**: HTML5 Canvas를 이용한 고성능 이미지 어노테이션
- **S3 연동**: AWS S3를 이용한 이미지 스토리지 및 presigned URL 방식
- **이중 데이터베이스**: User DB (SQLite, read-only) + Labeler DB (PostgreSQL, read-write)

---

## 아키텍쳐 구성 요소

### 1. Backend (FastAPI)

#### 디렉토리 구조
```
backend/
├── app/
│   ├── api/v1/
│   │   ├── endpoints/          # API 엔드포인트
│   │   │   ├── auth.py         # 인증 (로그인, 회원가입)
│   │   │   ├── datasets.py     # 데이터셋 CRUD
│   │   │   ├── projects.py     # 프로젝트 CRUD, 이미지 목록
│   │   │   ├── annotations.py  # 어노테이션 CRUD, 히스토리
│   │   │   ├── export.py       # Export (COCO, YOLO)
│   │   │   ├── image_locks.py  # 이미지 잠금 (Phase 8.5)
│   │   │   ├── invitations.py  # 데이터셋 초대 (Phase 8.3)
│   │   │   ├── project_permissions.py  # 권한 관리 (Phase 8.1)
│   │   │   └── users.py        # 사용자 조회
│   │   └── router.py           # 라우터 통합
│   ├── core/
│   │   ├── config.py           # 설정 (환경 변수)
│   │   ├── database.py         # DB 연결 (2 engines: User, Labeler)
│   │   └── security.py         # JWT, 비밀번호 해싱
│   ├── db/models/
│   │   ├── user.py             # User, Organization (read-only)
│   │   └── labeler.py          # Dataset, Project, Annotation 등
│   ├── schemas/                # Pydantic 스키마
│   └── services/               # 비즈니스 로직 (image_lock_service.py)
├── alembic/                    # DB 마이그레이션
└── main.py                     # FastAPI 앱 엔트리포인트
```

#### 주요 역할
- **API 제공**: RESTful API를 통한 데이터 CRUD
- **인증/인가**: JWT 토큰 기반 인증, RBAC 권한 관리
- **데이터베이스 관리**: SQLAlchemy ORM을 통한 데이터 접근
- **파일 스토리지**: S3 연동 (presigned URL 생성)
- **비즈니스 로직**: 어노테이션 충돌 방지, 락 관리, Export 등

### 2. Frontend (Next.js + React)

#### 디렉토리 구조
```
frontend/
├── app/
│   ├── page.tsx                # 홈 (데이터셋 목록)
│   ├── login/page.tsx          # 로그인
│   └── annotate/[projectId]/page.tsx  # 어노테이션 작업 화면
├── components/
│   ├── annotation/             # 어노테이션 UI
│   │   ├── Canvas.tsx          # 메인 Canvas (3800+ lines)
│   │   ├── LeftPanel.tsx       # 이미지 리스트
│   │   ├── RightPanel.tsx      # 어노테이션 리스트, 클래스, 히스토리
│   │   ├── TopBar.tsx          # 툴바 (도구 선택, 설정)
│   │   ├── BottomBar.tsx       # 페이지네이션, 상태
│   │   ├── Minimap.tsx         # 미니맵 (Phase 2.10.3)
│   │   ├── Magnifier.tsx       # 돋보기 (Phase 2.10.2)
│   │   └── ...
│   ├── datasets/               # 데이터셋 UI
│   │   ├── InviteDialog.tsx    # 멤버 초대
│   │   ├── DatasetMembersAvatars.tsx
│   │   └── ...
│   ├── invitations/            # 초대 관리
│   └── Sidebar.tsx             # 사이드바
├── lib/
│   ├── api/                    # API 클라이언트
│   │   ├── client.ts           # APIClient (fetch wrapper)
│   │   ├── annotations.ts      # 어노테이션 API
│   │   ├── datasets.ts         # 데이터셋 API
│   │   ├── projects.ts         # 프로젝트 API
│   │   ├── image-locks.ts      # 이미지 락 API
│   │   ├── invitations.ts      # 초대 API
│   │   └── users.ts            # 사용자 API
│   └── stores/                 # Zustand 상태 관리
│       ├── annotationStore.ts  # 메인 스토어 (1000+ lines)
│       ├── toastStore.ts       # Toast 알림
│       └── confirmStore.ts     # 확인 다이얼로그
└── public/                     # 정적 파일
```

#### 주요 역할
- **UI 렌더링**: React 컴포넌트 기반 UI
- **Canvas 렌더링**: HTML5 Canvas를 통한 고성능 이미지 및 어노테이션 렌더링
- **상태 관리**: Zustand를 통한 전역 상태 관리
- **API 통신**: Backend API와 통신 (JWT 토큰 포함)
- **실시간 UI 업데이트**: Optimistic UI 업데이트 + 백엔드 동기화

### 3. Database (PostgreSQL + SQLite)

#### 이중 데이터베이스 구조 (Phase 9)
- **User DB (SQLite, read-only)**: 사용자 및 조직 정보 (공유 DB)
- **Labeler DB (PostgreSQL, read-write)**: 레이블러 전용 데이터

#### Labeler DB 주요 테이블
```sql
-- 데이터셋 및 권한
datasets                    # 데이터셋 정보
dataset_permissions         # 데이터셋 권한 (deprecated, Phase 8.1에서 project_permissions로 대체)

-- 프로젝트 및 어노테이션
annotation_projects         # 어노테이션 프로젝트 (1:1 with Dataset)
project_permissions         # 프로젝트 권한 (5-role RBAC)
annotations                 # 어노테이션 데이터
annotation_history          # 어노테이션 변경 히스토리
annotation_project_classes  # 프로젝트별 클래스 정의

-- 이미지 메타데이터 (Phase 2.12)
image_metadata              # S3 이미지 메타데이터 캐시

-- 협업 기능 (Phase 8)
invitations                 # 데이터셋 초대
image_locks                 # 이미지 편집 잠금 (Phase 8.5)
```

#### User DB 주요 테이블 (read-only)
```sql
users                       # 사용자 정보
organizations               # 조직 정보
```

---

## 주요 기술 스택

### Backend
- **FastAPI**: 고성능 Python 웹 프레임워크
- **SQLAlchemy**: ORM (Object-Relational Mapping)
- **Alembic**: 데이터베이스 마이그레이션
- **Pydantic**: 데이터 검증 및 스키마 정의
- **JWT**: 인증 토큰
- **Boto3**: AWS S3 연동
- **PostgreSQL**: 메인 데이터베이스
- **SQLite**: User 데이터베이스 (read-only)

### Frontend
- **Next.js 14**: React 프레임워크 (App Router)
- **React 18**: UI 라이브러리
- **TypeScript**: 타입 안전성
- **Zustand**: 경량 상태 관리
- **Tailwind CSS**: 유틸리티 CSS 프레임워크
- **HTML5 Canvas**: 이미지 및 어노테이션 렌더링

---

## 데이터 모델

### 핵심 엔티티 관계

```
User (User DB, read-only)
  └─ 1:N → Dataset (owner_id)
            ├─ 1:1 → AnnotationProject
            │         ├─ 1:N → Annotation
            │         ├─ 1:N → ProjectPermission (Phase 8.1 RBAC)
            │         ├─ 1:N → AnnotationProjectClass
            │         └─ 1:N → ImageLock (Phase 8.5)
            ├─ 1:N → DatasetPermission (deprecated)
            ├─ 1:N → ImageMetadata (Phase 2.12)
            └─ 1:N → Invitation (Phase 8.3)
```

### 주요 모델 상세

#### Dataset
```python
class Dataset:
    id: str                      # Primary key
    name: str                    # 데이터셋 이름
    description: str             # 설명
    owner_id: int                # 소유자 (User.id)
    storage_path: str            # S3 경로
    storage_type: str            # "s3"
    num_images: int              # 이미지 개수
    class_names: str             # JSON (클래스 목록)
    status: str                  # "active" | "archived"
    created_at: datetime
    updated_at: datetime
```

#### AnnotationProject
```python
class AnnotationProject:
    id: str                      # Primary key
    name: str
    dataset_id: str              # 1:1 관계
    owner_id: int
    task_types: List[str]        # ["classification", "detection", ...]
    task_config: dict            # JSONB
    task_classes: dict           # {task_type: {class_id: {...}}}
    total_images: int
    annotated_images: int
    total_annotations: int
    status: str
    created_at: datetime
    updated_at: datetime
```

#### Annotation
```python
class Annotation:
    id: int                      # BigInteger primary key
    project_id: str
    image_id: str
    annotation_type: str         # "bbox", "polygon", "polyline", "circle", "classification"
    task_type: str               # "detection", "classification", ...
    geometry: dict               # JSONB (type별 다른 구조)
    class_id: str
    class_name: str
    attributes: dict             # JSONB
    confidence: float
    annotation_state: str        # "draft", "confirmed", "verified"
    version: int                 # Optimistic locking (Phase 8.5.1)
    created_by: int
    updated_by: int
    created_at: datetime
    updated_at: datetime
```

#### ProjectPermission (Phase 8.1)
```python
class ProjectPermission:
    id: int
    project_id: str
    user_id: int
    role: str                    # "owner", "admin", "reviewer", "annotator", "viewer"
    granted_by: int
    granted_at: datetime

# Role Hierarchy:
# owner > admin > reviewer > annotator > viewer
```

#### ImageLock (Phase 8.5)
```python
class ImageLock:
    id: int
    project_id: str
    image_id: str
    user_id: int                 # Lock holder
    lock_type: str               # "edit" (현재는 edit만 지원)
    acquired_at: datetime
    expires_at: datetime         # 5분 timeout
    last_heartbeat: datetime     # 2분마다 갱신

# Constraints: UNIQUE(project_id, image_id)
# 한 이미지는 한 사용자만 편집 가능
```

#### Invitation (Phase 8.3)
```python
class Invitation:
    id: int
    dataset_id: str
    project_id: str
    inviter_id: int              # 초대한 사람
    invitee_id: int              # 초대받은 사람 (nullable, email로 초대 가능)
    invitee_email: str           # 이메일 (user_id 없을 경우)
    role: str                    # ProjectPermission role과 동일
    status: str                  # "pending", "accepted", "declined", "cancelled"
    token: str                   # UUID (초대 링크)
    expires_at: datetime         # 7일
    created_at: datetime
```

---

## API 구조

### API Base URL
- Backend: `http://localhost:8001` (개발)
- Frontend: `http://localhost:3000` (개발)

### 주요 엔드포인트

#### 인증 (Authentication)
```
POST   /api/v1/auth/login              # 로그인
POST   /api/v1/auth/register           # 회원가입
POST   /api/v1/auth/logout             # 로그아웃
GET    /api/v1/auth/me                 # 현재 사용자 정보
```

#### 데이터셋 (Datasets)
```
GET    /api/v1/datasets                # 내 데이터셋 목록
POST   /api/v1/datasets                # 데이터셋 생성
GET    /api/v1/datasets/{dataset_id}   # 데이터셋 상세
PUT    /api/v1/datasets/{dataset_id}   # 데이터셋 수정
DELETE /api/v1/datasets/{dataset_id}   # 데이터셋 삭제
```

#### 프로젝트 (Projects)
```
GET    /api/v1/projects                           # 내 프로젝트 목록
POST   /api/v1/projects                           # 프로젝트 생성
GET    /api/v1/projects/{project_id}              # 프로젝트 상세
PUT    /api/v1/projects/{project_id}              # 프로젝트 수정
DELETE /api/v1/projects/{project_id}              # 프로젝트 삭제
GET    /api/v1/projects/{project_id}/images       # 이미지 목록 (pagination)
GET    /api/v1/projects/{project_id}/summary      # 프로젝트 요약
POST   /api/v1/projects/{project_id}/classes      # 클래스 추가
DELETE /api/v1/projects/{project_id}/classes/{class_id}  # 클래스 삭제
```

#### 어노테이션 (Annotations)
```
GET    /api/v1/annotations/project/{project_id}         # 프로젝트 어노테이션 목록
POST   /api/v1/annotations                              # 어노테이션 생성
PUT    /api/v1/annotations/{annotation_id}              # 어노테이션 수정
DELETE /api/v1/annotations/{annotation_id}              # 어노테이션 삭제
POST   /api/v1/annotations/{annotation_id}/confirm      # 어노테이션 확인
POST   /api/v1/annotations/{annotation_id}/unconfirm    # 어노테이션 확인 취소
GET    /api/v1/annotations/history/project/{project_id} # 프로젝트 히스토리
GET    /api/v1/annotations/history/annotation/{ann_id}  # 어노테이션 히스토리
```

#### Export
```
POST   /api/v1/export/coco/{project_id}     # COCO 형식 export
POST   /api/v1/export/yolo/{project_id}     # YOLO 형식 export
```

#### 이미지 락 (Image Locks - Phase 8.5)
```
POST   /api/v1/image-locks/acquire           # 락 획득
POST   /api/v1/image-locks/release           # 락 해제
POST   /api/v1/image-locks/heartbeat         # 락 갱신 (heartbeat)
GET    /api/v1/image-locks/status            # 락 상태 조회
GET    /api/v1/image-locks/project/{project_id}  # 프로젝트 전체 락 목록
```

#### 초대 (Invitations - Phase 8.3)
```
POST   /api/v1/invitations                   # 초대 생성
GET    /api/v1/invitations                   # 내가 받은 초대 목록
GET    /api/v1/invitations/sent              # 내가 보낸 초대 목록
GET    /api/v1/invitations/{invitation_id}   # 초대 상세
PUT    /api/v1/invitations/{invitation_id}/accept    # 초대 수락
PUT    /api/v1/invitations/{invitation_id}/decline   # 초대 거절
DELETE /api/v1/invitations/{invitation_id}   # 초대 취소
```

#### 권한 (Project Permissions - Phase 8.1)
```
GET    /api/v1/projects/{project_id}/permissions        # 프로젝트 멤버 목록
POST   /api/v1/projects/{project_id}/permissions        # 멤버 추가
PUT    /api/v1/projects/{project_id}/permissions/{user_id}  # 역할 변경
DELETE /api/v1/projects/{project_id}/permissions/{user_id}  # 멤버 제거
```

#### 사용자 (Users)
```
GET    /api/v1/users                   # 사용자 검색
GET    /api/v1/users/{user_id}         # 사용자 상세
```

---

## Frontend 상태 관리

### Zustand Store 구조

#### annotationStore (메인 스토어)
```typescript
interface AnnotationStore {
  // 프로젝트 및 데이터셋
  project: Project | null;
  dataset: Dataset | null;

  // 이미지
  images: Image[];
  currentImage: Image | null;

  // 어노테이션
  annotations: Annotation[];
  selectedAnnotationId: string | null;

  // Canvas 상태
  canvas: {
    tool: 'select' | 'bbox' | 'polygon' | 'polyline' | 'circle' | 'pan';
    zoom: number;
    pan: { x: number; y: number };
    showLabels: boolean;
    highlightMode: boolean;
  };

  // Phase 2.10: Undo/Redo
  history: {
    past: AnnotationSnapshot[];
    future: AnnotationSnapshot[];
  };
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  // Phase 2.10.2: Magnifier
  showMagnifier: boolean;
  magnifierSize: number;
  magnifierZoom: number;

  // Phase 2.10.3: Minimap
  showMinimap: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement> | null;
  imageRef: React.RefObject<HTMLImageElement> | null;

  // Phase 8.1: RBAC
  projectPermissions: ProjectPermission[];
  currentUserRole: Role | null;

  // Phase 8.5: Image Locks
  projectLocks: ImageLock[];

  // Actions
  setProject: (project: Project) => void;
  loadImages: (projectId: string) => Promise<void>;
  loadAnnotations: (projectId: string, imageId: string) => Promise<void>;
  createAnnotation: (data: AnnotationCreateRequest) => Promise<void>;
  updateAnnotation: (id: string, data: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => Promise<void>;
  confirmAnnotation: (id: string) => Promise<void>;
  // ... 등등
}
```

### API Client 패턴

모든 API 호출은 `lib/api/` 폴더의 모듈화된 클라이언트를 통해 이루어집니다.

```typescript
// lib/api/client.ts
export class APIClient {
  private baseURL: string;
  private token: string | null;

  async get<T>(endpoint: string): Promise<T>;
  async post<T>(endpoint: string, data?: any): Promise<T>;
  async put<T>(endpoint: string, data: any): Promise<T>;
  async delete<T>(endpoint: string): Promise<T>;
}

export const apiClient = new APIClient();
```

각 도메인별 API 클라이언트:
```typescript
// lib/api/annotations.ts
export async function getProjectAnnotations(projectId: string): Promise<Annotation[]>
export async function createAnnotation(data: AnnotationCreateRequest): Promise<Annotation>
export async function updateAnnotation(id: string, data: AnnotationUpdateRequest): Promise<Annotation>
export async function deleteAnnotation(id: string): Promise<void>

// lib/api/image-locks.ts
export async function acquireLock(projectId: string, imageId: string): Promise<LockAcquireResponse>
export async function releaseLock(projectId: string, imageId: string): Promise<void>
export async function sendHeartbeat(projectId: string, imageId: string): Promise<void>
```

---

## 주요 사용자 시나리오

### 1. 로그인 및 내 데이터셋 조회

#### 시나리오
1. 사용자가 `/login` 페이지에서 이메일과 비밀번호 입력
2. 로그인 성공 시 JWT 토큰 발급 및 저장
3. 홈 화면(`/`)으로 리디렉션
4. 내 데이터셋 목록 로드

#### 내부 동작

**Frontend:**
```typescript
// 1. 로그인 버튼 클릭
const handleLogin = async () => {
  // POST /api/v1/auth/login
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  const { access_token } = await response.json();

  // 2. 토큰 저장 (localStorage)
  localStorage.setItem('access_token', access_token);
  apiClient.setToken(access_token);

  // 3. 홈으로 이동
  router.push('/');
};

// 4. 홈 페이지 로드 (app/page.tsx)
useEffect(() => {
  // GET /api/v1/datasets (JWT 토큰 포함)
  const datasets = await fetch('/api/v1/datasets', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}, []);
```

**Backend:**
```python
# POST /api/v1/auth/login
@router.post("/login")
async def login(credentials: LoginRequest):
    # 1. User DB에서 사용자 조회 (read-only)
    user = user_db.query(User).filter(User.email == credentials.email).first()

    # 2. 비밀번호 검증
    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")

    # 3. JWT 토큰 생성
    access_token = create_access_token({"sub": str(user.id)})

    return {"access_token": access_token, "token_type": "bearer"}

# GET /api/v1/datasets
@router.get("/datasets")
async def get_datasets(current_user: User = Depends(get_current_user)):
    # 1. Labeler DB에서 내가 owner이거나 member인 데이터셋 조회
    # Owner datasets
    owner_datasets = labeler_db.query(Dataset).filter(
        Dataset.owner_id == current_user.id
    ).all()

    # Member datasets (via ProjectPermission, Phase 8.1)
    member_project_ids = labeler_db.query(ProjectPermission.project_id).filter(
        ProjectPermission.user_id == current_user.id
    ).all()

    member_datasets = labeler_db.query(Dataset).join(AnnotationProject).filter(
        AnnotationProject.id.in_(member_project_ids)
    ).all()

    return owner_datasets + member_datasets
```

**데이터 흐름:**
```
[사용자 입력]
  → Frontend (login form)
  → POST /api/v1/auth/login
  → Backend: User DB 조회 + 비밀번호 검증
  → JWT 토큰 생성 및 반환
  → Frontend: 토큰 저장 (localStorage)
  → 홈으로 리디렉션
  → GET /api/v1/datasets (Authorization: Bearer {token})
  → Backend: Labeler DB 조회 (owner + member datasets)
  → Frontend: 데이터셋 목록 렌더링
```

---

### 2. 데이터셋 요약 화면

#### 시나리오
1. 홈 화면에서 데이터셋 카드 클릭
2. 데이터셋 상세 정보 및 프로젝트 정보 로드
3. 프로젝트 요약 (이미지 개수, 어노테이션 통계 등) 표시

#### 내부 동작

**Frontend:**
```typescript
// 데이터셋 카드 클릭 시
const handleDatasetClick = async (datasetId: string) => {
  // 1. GET /api/v1/datasets/{dataset_id}
  const dataset = await fetchDataset(datasetId);

  // 2. GET /api/v1/projects (dataset_id로 필터링)
  const projects = await fetchProjects(datasetId);
  const project = projects[0]; // 1:1 관계

  // 3. GET /api/v1/projects/{project_id}/summary
  const summary = await fetchProjectSummary(project.id);

  // 4. 요약 데이터 렌더링
  renderSummary({ dataset, project, summary });
};
```

**Backend:**
```python
# GET /api/v1/projects/{project_id}/summary
@router.get("/{project_id}/summary")
async def get_project_summary(project_id: str, current_user: User = Depends(get_current_user)):
    # 1. 권한 확인 (Phase 8.1)
    permission = check_permission(project_id, current_user.id, min_role="viewer")

    # 2. 프로젝트 조회
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    # 3. 이미지 통계 (image_metadata 테이블에서 조회, Phase 2.12)
    total_images = labeler_db.query(func.count(ImageMetadata.id)).filter(
        ImageMetadata.dataset_id == project.dataset_id
    ).scalar()

    # 4. 어노테이션 통계
    total_annotations = labeler_db.query(func.count(Annotation.id)).filter(
        Annotation.project_id == project_id
    ).scalar()

    # 5. 이미지별 상태 통계 (confirmed, in-progress, etc.)
    # 복잡한 쿼리...

    # 6. 클래스별 통계
    class_counts = get_class_annotation_counts(project_id)

    return {
        "total_images": total_images,
        "total_annotations": total_annotations,
        "class_counts": class_counts,
        "status_breakdown": {...},
        # ...
    }
```

**데이터 흐름:**
```
[데이터셋 클릭]
  → GET /api/v1/datasets/{id}
  → GET /api/v1/projects (필터: dataset_id)
  → GET /api/v1/projects/{project_id}/summary
  → Backend: Labeler DB 집계 쿼리 (이미지, 어노테이션, 클래스별 통계)
  → Frontend: 요약 데이터 렌더링 (차트, 통계)
```

---

### 3. 데이터셋에 사용자 초대 및 수락 (Phase 8.3)

#### 시나리오
1. Owner/Admin이 데이터셋 설정에서 "Invite Member" 클릭
2. 초대할 사용자 이메일과 역할 선택
3. 초대 생성 (Invitation 레코드 생성, 이메일 발송 또는 링크 공유)
4. 초대받은 사용자가 초대 링크 접근 또는 "내 초대" 페이지에서 확인
5. 초대 수락 시 ProjectPermission 레코드 생성

#### 내부 동작

**Frontend (초대 생성):**
```typescript
// InviteDialog.tsx
const handleInvite = async () => {
  // POST /api/v1/invitations
  const invitation = await createInvitation({
    dataset_id: dataset.id,
    project_id: project.id,
    invitee_email: email,
    role: selectedRole, // "admin", "reviewer", "annotator", "viewer"
  });

  // 초대 링크 생성 (예: /accept-invite?token={invitation.token})
  const inviteLink = `${window.location.origin}/accept-invite?token=${invitation.token}`;

  // 사용자에게 링크 표시 (복사 가능)
  showInviteLink(inviteLink);
};
```

**Backend (초대 생성):**
```python
# POST /api/v1/invitations
@router.post("/invitations")
async def create_invitation(
    request: InvitationCreateRequest,
    current_user: User = Depends(get_current_user)
):
    # 1. 권한 확인 (owner 또는 admin만 초대 가능)
    permission = check_permission(request.project_id, current_user.id, min_role="admin")

    # 2. 초대할 사용자 조회 (User DB)
    invitee = user_db.query(User).filter(User.email == request.invitee_email).first()

    # 3. 이미 멤버인지 확인
    existing = labeler_db.query(ProjectPermission).filter(
        ProjectPermission.project_id == request.project_id,
        ProjectPermission.user_id == invitee.id if invitee else None
    ).first()
    if existing:
        raise HTTPException(400, "User is already a member")

    # 4. Invitation 레코드 생성
    invitation = Invitation(
        dataset_id=request.dataset_id,
        project_id=request.project_id,
        inviter_id=current_user.id,
        invitee_id=invitee.id if invitee else None,
        invitee_email=request.invitee_email,
        role=request.role,
        status="pending",
        token=str(uuid.uuid4()),
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    labeler_db.add(invitation)
    labeler_db.commit()

    return invitation
```

**Frontend (초대 수락):**
```typescript
// InvitationsPanel.tsx 또는 accept-invite 페이지
const handleAccept = async (invitationId: number) => {
  // PUT /api/v1/invitations/{invitation_id}/accept
  await acceptInvitation(invitationId);

  // 초대 수락 시 자동으로 ProjectPermission 생성됨
  toast.success('Invitation accepted!');

  // 데이터셋 목록 새로고침
  router.push('/');
};
```

**Backend (초대 수락):**
```python
# PUT /api/v1/invitations/{invitation_id}/accept
@router.put("/{invitation_id}/accept")
async def accept_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user)
):
    # 1. Invitation 조회
    invitation = labeler_db.query(Invitation).filter(
        Invitation.id == invitation_id,
        Invitation.invitee_id == current_user.id,
        Invitation.status == "pending"
    ).first()
    if not invitation:
        raise HTTPException(404, "Invitation not found")

    # 2. 만료 확인
    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(400, "Invitation expired")

    # 3. ProjectPermission 생성
    permission = ProjectPermission(
        project_id=invitation.project_id,
        user_id=current_user.id,
        role=invitation.role,
        granted_by=invitation.inviter_id,
        granted_at=datetime.utcnow()
    )
    labeler_db.add(permission)

    # 4. Invitation 상태 업데이트
    invitation.status = "accepted"
    labeler_db.commit()

    return {"status": "accepted"}
```

**데이터 흐름:**
```
[초대 생성]
  → Frontend: InviteDialog (이메일, 역할 입력)
  → POST /api/v1/invitations
  → Backend: 권한 확인 → Invitation 레코드 생성 → 토큰 생성
  → Frontend: 초대 링크 표시

[초대 수락]
  → Frontend: 내 초대 목록 또는 링크 접근
  → PUT /api/v1/invitations/{id}/accept
  → Backend: Invitation 확인 → ProjectPermission 생성 → Invitation.status = "accepted"
  → Frontend: 데이터셋 목록에 새 데이터셋 나타남
```

---

### 4. 레이블러 화면 진입 및 페이지네이션 (Phase 2.12)

#### 시나리오
1. 데이터셋에서 "Annotate" 버튼 클릭
2. 레이블러 화면(`/annotate/[projectId]`)으로 이동
3. 프로젝트 정보, 첫 페이지 이미지 목록, 첫 이미지의 어노테이션 로드
4. 좌측 패널에서 다른 이미지 클릭 시 해당 이미지 및 어노테이션 로드
5. 페이지네이션 (하단 바에서 Next/Previous)

#### 내부 동작

**Frontend (페이지 진입):**
```typescript
// app/annotate/[projectId]/page.tsx
useEffect(() => {
  const initializeAnnotator = async () => {
    // 1. GET /api/v1/projects/{projectId}
    const project = await fetchProject(projectId);
    annotationStore.setProject(project);

    // 2. GET /api/v1/projects/{projectId}/images?skip=0&limit=50 (Phase 2.12 pagination)
    const images = await fetchImages(projectId, { skip: 0, limit: 50 });
    annotationStore.setImages(images);

    // 3. 첫 이미지 선택
    const firstImage = images[0];
    annotationStore.setCurrentImage(firstImage);

    // 4. GET /api/v1/annotations/project/{projectId}?image_id={imageId}
    const annotations = await fetchAnnotations(projectId, firstImage.id);
    annotationStore.setAnnotations(annotations);

    // 5. 이미지 락 획득 시도 (Phase 8.5)
    await acquireLock(projectId, firstImage.id);
  };

  initializeAnnotator();
}, [projectId]);
```

**Backend (이미지 목록 - Phase 2.12):**
```python
# GET /api/v1/projects/{project_id}/images
@router.get("/{project_id}/images")
async def get_project_images(
    project_id: str,
    skip: int = 0,
    limit: int = 50,
    folder: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    # 1. 권한 확인
    check_permission(project_id, current_user.id, min_role="viewer")

    # 2. 프로젝트 조회
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    # 3. Phase 2.12: image_metadata 테이블에서 페이지네이션 (DB 쿼리)
    # 이전에는 S3 list_objects로 전체 목록을 가져왔으나,
    # 이제는 DB에서 offset/limit으로 빠르게 조회
    query = labeler_db.query(ImageMetadata).filter(
        ImageMetadata.dataset_id == project.dataset_id
    )

    if folder:
        query = query.filter(ImageMetadata.folder_path == folder)

    # 정렬 및 페이지네이션
    images = query.order_by(ImageMetadata.uploaded_at.desc()).offset(skip).limit(limit).all()

    # 4. 각 이미지에 대해 presigned URL 생성 (S3)
    result = []
    for img in images:
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET, 'Key': img.s3_key},
            ExpiresIn=3600
        )

        # 5. 어노테이션 개수 조회
        annotation_count = labeler_db.query(func.count(Annotation.id)).filter(
            Annotation.project_id == project_id,
            Annotation.image_id == img.id
        ).scalar()

        result.append({
            "id": img.id,
            "file_name": img.file_name,
            "url": presigned_url,
            "width": img.width,
            "height": img.height,
            "annotation_count": annotation_count,
            "status": "completed" if annotation_count > 0 else "pending",
        })

    return result
```

**Frontend (이미지 변경):**
```typescript
// ImageList.tsx (좌측 패널)
const handleImageClick = async (image: Image) => {
  // 1. 현재 이미지 락 해제 (Phase 8.5)
  if (currentImage) {
    await releaseLock(project.id, currentImage.id);
  }

  // 2. 새 이미지 설정
  annotationStore.setCurrentImage(image);

  // 3. 새 이미지의 어노테이션 로드
  const annotations = await fetchAnnotations(project.id, image.id);
  annotationStore.setAnnotations(annotations);

  // 4. 새 이미지 락 획득
  const lockResult = await acquireLock(project.id, image.id);
  if (lockResult.status === 'already_locked') {
    // 다른 사용자가 편집 중
    showLockedOverlay(lockResult.locked_by);
  }
};
```

**Frontend (페이지네이션):**
```typescript
// BottomBar.tsx
const handleNextPage = async () => {
  const nextSkip = currentSkip + pageSize;

  // GET /api/v1/projects/{projectId}/images?skip={nextSkip}&limit=50
  const nextImages = await fetchImages(projectId, { skip: nextSkip, limit: 50 });

  annotationStore.setImages([...images, ...nextImages]); // 또는 교체
  setCurrentSkip(nextSkip);
};
```

**데이터 흐름:**
```
[레이블러 진입]
  → GET /api/v1/projects/{id}
  → GET /api/v1/projects/{id}/images?skip=0&limit=50
  → Backend: image_metadata 테이블 쿼리 (Phase 2.12, 빠른 DB 조회)
  → Backend: 각 이미지에 대해 S3 presigned URL 생성
  → Frontend: 이미지 목록 렌더링 (좌측 패널)
  → 첫 이미지 선택
  → GET /api/v1/annotations/project/{id}?image_id={imageId}
  → POST /api/v1/image-locks/acquire (Phase 8.5)
  → Frontend: Canvas에 이미지 및 어노테이션 렌더링

[이미지 변경]
  → POST /api/v1/image-locks/release (현재 이미지)
  → GET /api/v1/annotations/project/{id}?image_id={newImageId}
  → POST /api/v1/image-locks/acquire (새 이미지)
  → Frontend: Canvas 업데이트

[페이지네이션]
  → GET /api/v1/projects/{id}/images?skip=50&limit=50
  → Frontend: 다음 페이지 이미지 추가
```

**Phase 2.12 개선점:**
- 이전: S3 `list_objects` 호출 → 전체 목록 가져온 후 Frontend에서 페이지네이션 → 느림
- 현재: DB `image_metadata` 테이블 → `OFFSET/LIMIT` 쿼리 → 빠름 + 효율적

---

### 5. BBox 입력 (어노테이션 생성 및 편집)

#### 시나리오
1. 사용자가 툴바에서 BBox 도구 선택
2. Canvas에서 드래그하여 BBox 생성
3. 클래스 선택 모달 표시
4. 클래스 선택 후 어노테이션 저장
5. BBox 크기 조정 (resize handles)
6. Undo/Redo 지원 (Phase 2.10)

#### 내부 동작

**Frontend (BBox 생성):**
```typescript
// Canvas.tsx
const handleMouseDown = (e: React.MouseEvent) => {
  if (canvas.tool !== 'bbox') return;

  // 1. Canvas 좌표 → 이미지 좌표 변환
  const { x, y } = canvasToImageCoords(e.clientX, e.clientY);

  // 2. 드래그 시작점 저장
  setDrawingStart({ x, y });
};

const handleMouseMove = (e: React.MouseEvent) => {
  if (!drawingStart) return;

  // 3. 현재 마우스 위치 → BBox 크기 계산
  const { x, y } = canvasToImageCoords(e.clientX, e.clientY);
  const width = x - drawingStart.x;
  const height = y - drawingStart.y;

  // 4. 임시 BBox 렌더링 (Canvas에 점선으로 표시)
  drawTempBBox(drawingStart.x, drawingStart.y, width, height);
};

const handleMouseUp = async (e: React.MouseEvent) => {
  if (!drawingStart) return;

  // 5. 최종 BBox 좌표 계산
  const { x, y } = canvasToImageCoords(e.clientX, e.clientY);
  const width = x - drawingStart.x;
  const height = y - drawingStart.y;

  // 6. 최소 크기 검증 (너무 작으면 무시)
  if (Math.abs(width) < 5 || Math.abs(height) < 5) {
    return;
  }

  // 7. 클래스 선택 모달 표시
  setTempBBox({ x: drawingStart.x, y, width, height });
  setShowClassSelector(true);
};

// 클래스 선택 후
const handleClassSelected = async (classId: string, className: string) => {
  // 8. 어노테이션 생성
  const annotationData = {
    project_id: project.id,
    image_id: currentImage.id,
    annotation_type: 'bbox',
    geometry: {
      type: 'bbox',
      bbox: [tempBBox.x, tempBBox.y, tempBBox.width, tempBBox.height],
    },
    class_id: classId,
    class_name: className,
  };

  // 9. POST /api/v1/annotations
  const newAnnotation = await createAnnotation(annotationData);

  // 10. Store에 추가 (Optimistic UI)
  annotationStore.addAnnotation(newAnnotation);

  // 11. Undo/Redo 히스토리 기록 (Phase 2.10)
  annotationStore.recordSnapshot();

  toast.success('Annotation created');
};
```

**Backend (어노테이션 생성):**
```python
# POST /api/v1/annotations
@router.post("/annotations")
async def create_annotation(
    request: AnnotationCreateRequest,
    current_user: User = Depends(get_current_user)
):
    # 1. 권한 확인 (annotator 이상)
    permission = check_permission(request.project_id, current_user.id, min_role="annotator")

    # 2. Phase 8.5.2: 이미지 락 확인 (Strict Lock Policy)
    lock = labeler_db.query(ImageLock).filter(
        ImageLock.project_id == request.project_id,
        ImageLock.image_id == request.image_id
    ).first()

    if not lock or lock.user_id != current_user.id:
        raise HTTPException(423, "Image is not locked. Please acquire lock before editing.")

    # 3. Annotation 레코드 생성
    annotation = Annotation(
        project_id=request.project_id,
        image_id=request.image_id,
        annotation_type=request.annotation_type,
        task_type=infer_task_type(request.annotation_type),
        geometry=request.geometry,
        class_id=request.class_id,
        class_name=request.class_name,
        annotation_state="draft",
        version=1,  # Phase 8.5.1: Optimistic locking
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    labeler_db.add(annotation)
    labeler_db.commit()
    labeler_db.refresh(annotation)

    # 4. AnnotationHistory 레코드 생성 (변경 추적)
    history = AnnotationHistory(
        annotation_id=annotation.id,
        project_id=annotation.project_id,
        action="created",
        previous_state=None,
        new_state=annotation.geometry,
        changed_by=current_user.id,
    )
    labeler_db.add(history)
    labeler_db.commit()

    # 5. 프로젝트 통계 업데이트 (total_annotations++)
    update_project_stats(request.project_id)

    return annotation
```

**Frontend (BBox 크기 조정):**
```typescript
// Canvas.tsx - Resize handles
const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
  // 1. Resize 시작 (handle: 'tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r')
  setResizingHandle(handle);
  setResizeStart({ x: e.clientX, y: e.clientY });
};

const handleResizeMouseMove = (e: React.MouseEvent) => {
  if (!resizingHandle) return;

  // 2. 마우스 이동량 계산
  const dx = e.clientX - resizeStart.x;
  const dy = e.clientY - resizeStart.y;

  // 3. Handle에 따라 BBox 크기 조정
  const newBBox = calculateResizedBBox(selectedAnnotation.geometry.bbox, resizingHandle, dx, dy);

  // 4. 임시로 렌더링
  drawResizingBBox(newBBox);
};

const handleResizeMouseUp = async () => {
  if (!resizingHandle) return;

  // 5. 최종 BBox 좌표로 어노테이션 업데이트
  const updatedGeometry = {
    type: 'bbox',
    bbox: [newX, newY, newWidth, newHeight],
  };

  // 6. PUT /api/v1/annotations/{annotation_id}
  await updateAnnotation(selectedAnnotationId, { geometry: updatedGeometry });

  // 7. Store 업데이트 (with history recording, Phase 2.10)
  annotationStore.updateAnnotation(selectedAnnotationId, { geometry: updatedGeometry });

  setResizingHandle(null);
};
```

**Backend (어노테이션 업데이트):**
```python
# PUT /api/v1/annotations/{annotation_id}
@router.put("/{annotation_id}")
async def update_annotation(
    annotation_id: int,
    request: AnnotationUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    # 1. Annotation 조회
    annotation = labeler_db.query(Annotation).filter(
        Annotation.id == annotation_id
    ).first()
    if not annotation:
        raise HTTPException(404, "Annotation not found")

    # 2. 권한 확인 (reviewer는 모든 어노테이션 수정 가능, annotator는 본인 것만)
    permission = check_permission(annotation.project_id, current_user.id, min_role="annotator")
    if permission.role == "annotator" and annotation.created_by != current_user.id:
        raise HTTPException(403, "Cannot edit others' annotations")

    # 3. Phase 8.5.2: 이미지 락 확인
    lock = labeler_db.query(ImageLock).filter(
        ImageLock.project_id == annotation.project_id,
        ImageLock.image_id == annotation.image_id
    ).first()
    if not lock or lock.user_id != current_user.id:
        raise HTTPException(423, "Image is not locked")

    # 4. Phase 8.5.1: Optimistic locking (version 충돌 확인)
    if request.version and request.version != annotation.version:
        raise HTTPException(409, "Annotation was modified by another user")

    # 5. 변경 사항 저장
    previous_state = annotation.geometry

    if request.geometry:
        annotation.geometry = request.geometry
    if request.class_id:
        annotation.class_id = request.class_id
    if request.class_name:
        annotation.class_name = request.class_name

    annotation.version += 1
    annotation.updated_by = current_user.id
    annotation.updated_at = datetime.utcnow()

    labeler_db.commit()
    labeler_db.refresh(annotation)

    # 6. AnnotationHistory 추가
    history = AnnotationHistory(
        annotation_id=annotation.id,
        project_id=annotation.project_id,
        action="updated",
        previous_state=previous_state,
        new_state=annotation.geometry,
        changed_by=current_user.id,
    )
    labeler_db.add(history)
    labeler_db.commit()

    return annotation
```

**Frontend (Undo/Redo - Phase 2.10):**
```typescript
// annotationStore.ts
undo: async () => {
  const { history, annotations, project, currentImage } = get();
  if (history.past.length === 0) return;

  const previous = history.past[history.past.length - 1];

  // 1. Phase 8.5: 이미지 락 획득 시도
  const lockResult = await acquireLock(project.id, currentImage.id);
  if (lockResult.status !== 'acquired' && lockResult.status !== 'already_acquired') {
    toast.error('Cannot undo: Image is locked by another user');
    return;
  }

  // 2. Backend 동기화: 현재 vs 이전 비교
  const currentIds = new Set(annotations.map(a => a.id));
  const previousIds = new Set(previous.annotations.map(a => a.id));

  // 3. 추가된 어노테이션 삭제
  for (const ann of annotations) {
    if (!previousIds.has(ann.id)) {
      await deleteAnnotation(ann.id); // DELETE /api/v1/annotations/{id}
    }
  }

  // 4. 삭제된 어노테이션 재생성
  for (const ann of previous.annotations) {
    if (!currentIds.has(ann.id)) {
      await createAnnotation({...}); // POST /api/v1/annotations
    }
  }

  // 5. 변경된 어노테이션 업데이트
  for (const prevAnn of previous.annotations) {
    const currAnn = annotations.find(a => a.id === prevAnn.id);
    if (currAnn && JSON.stringify(prevAnn.geometry) !== JSON.stringify(currAnn.geometry)) {
      await updateAnnotation(prevAnn.id, { geometry: prevAnn.geometry }); // PUT
    }
  }

  // 6. Frontend 상태 업데이트
  set({
    annotations: previous.annotations,
    history: {
      past: history.past.slice(0, -1),
      future: [currentSnapshot, ...history.future],
    },
  });
};
```

**데이터 흐름:**
```
[BBox 생성]
  → Frontend: Canvas mouseDown → drag → mouseUp
  → Frontend: 클래스 선택 모달
  → POST /api/v1/annotations (geometry, class_id, class_name)
  → Backend: 권한 확인 → 이미지 락 확인 → Annotation 생성 → AnnotationHistory 생성
  → Frontend: Store에 추가 → Canvas 재렌더링 → Undo 히스토리 기록

[BBox 크기 조정]
  → Frontend: Canvas resize handle drag
  → PUT /api/v1/annotations/{id} (new geometry)
  → Backend: 권한 확인 → 락 확인 → Version 충돌 확인 → 업데이트 → History 기록
  → Frontend: Store 업데이트 → Canvas 재렌더링 → Undo 히스토리 기록

[Undo]
  → Frontend: Ctrl+Z 단축키
  → annotationStore.undo()
  → POST /api/v1/image-locks/acquire (락 획득)
  → Backend 동기화 (DELETE/CREATE/UPDATE annotations)
  → Frontend: 상태 업데이트 → Canvas 재렌더링
```

---

### 6. Publish 동작 (어노테이션 Export)

#### 시나리오
1. 레이블러 화면에서 "Export" 버튼 클릭
2. Export 모달에서 형식 선택 (COCO, YOLO, etc.)
3. Export 설정 (포함할 이미지, 클래스 필터 등)
4. Export 시작 → 백엔드에서 파일 생성
5. 다운로드 링크 제공 (S3 presigned URL 또는 직접 다운로드)

#### 내부 동작

**Frontend:**
```typescript
// ExportModal.tsx
const handleExport = async () => {
  // 1. Export 요청
  // POST /api/v1/export/coco/{project_id}
  const exportResult = await fetch(`/api/v1/export/coco/${project.id}`, {
    method: 'POST',
    body: JSON.stringify({
      include_images: true,
      filter_confirmed_only: true,
      split_ratio: { train: 0.8, val: 0.1, test: 0.1 },
    }),
  });

  const { download_url, file_name } = await exportResult.json();

  // 2. 다운로드
  window.location.href = download_url;

  toast.success(`Exported: ${file_name}`);
};
```

**Backend:**
```python
# POST /api/v1/export/coco/{project_id}
@router.post("/export/coco/{project_id}")
async def export_coco(
    project_id: str,
    request: ExportRequest,
    current_user: User = Depends(get_current_user)
):
    # 1. 권한 확인 (viewer 이상)
    check_permission(project_id, current_user.id, min_role="viewer")

    # 2. 프로젝트 및 어노테이션 조회
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    # 3. 필터링된 어노테이션 조회
    query = labeler_db.query(Annotation).filter(
        Annotation.project_id == project_id
    )

    if request.filter_confirmed_only:
        query = query.filter(Annotation.annotation_state == "confirmed")

    annotations = query.all()

    # 4. 이미지 메타데이터 조회
    images = labeler_db.query(ImageMetadata).filter(
        ImageMetadata.dataset_id == project.dataset_id
    ).all()

    # 5. COCO 형식으로 변환
    coco_data = {
        "info": {
            "description": project.description,
            "version": "1.0",
            "year": datetime.utcnow().year,
            "date_created": datetime.utcnow().isoformat(),
        },
        "images": [],
        "annotations": [],
        "categories": [],
    }

    # Categories (클래스)
    for task_type, classes in project.task_classes.items():
        for class_id, class_info in classes.items():
            coco_data["categories"].append({
                "id": int(class_id),
                "name": class_info["name"],
                "supercategory": task_type,
            })

    # Images
    for img in images:
        coco_data["images"].append({
            "id": img.id,
            "file_name": img.file_name,
            "width": img.width,
            "height": img.height,
        })

    # Annotations
    for ann in annotations:
        if ann.annotation_type == "bbox":
            # COCO bbox format: [x, y, width, height]
            bbox = ann.geometry["bbox"]
            coco_data["annotations"].append({
                "id": ann.id,
                "image_id": ann.image_id,
                "category_id": int(ann.class_id),
                "bbox": bbox,
                "area": bbox[2] * bbox[3],
                "iscrowd": 0,
            })
        elif ann.annotation_type == "polygon":
            # COCO segmentation format: [[x1, y1, x2, y2, ...]]
            points = ann.geometry["points"]
            flattened = [coord for point in points for coord in point]
            coco_data["annotations"].append({
                "id": ann.id,
                "image_id": ann.image_id,
                "category_id": int(ann.class_id),
                "segmentation": [flattened],
                "area": calculate_polygon_area(points),
                "iscrowd": 0,
            })

    # 6. JSON 파일 생성 및 S3 업로드
    export_file_name = f"{project.id}_coco_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    export_key = f"exports/{project.id}/{export_file_name}"

    s3_client.put_object(
        Bucket=BUCKET,
        Key=export_key,
        Body=json.dumps(coco_data, indent=2),
        ContentType="application/json"
    )

    # 7. Presigned URL 생성 (1시간)
    download_url = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': BUCKET, 'Key': export_key},
        ExpiresIn=3600
    )

    return {
        "status": "success",
        "file_name": export_file_name,
        "download_url": download_url,
    }
```

**데이터 흐름:**
```
[Export 요청]
  → Frontend: ExportModal (형식, 설정 선택)
  → POST /api/v1/export/coco/{project_id}
  → Backend: 권한 확인 → 어노테이션 조회 (필터링) → COCO 형식 변환 → JSON 생성 → S3 업로드 → Presigned URL 생성
  → Frontend: 다운로드 링크 표시 → 사용자가 다운로드
```

---

### 7. Confirm 동작 (어노테이션 확인)

#### 시나리오
1. Annotator가 어노테이션 작업 완료
2. Reviewer 또는 본인이 어노테이션 확인 (Confirm)
3. 어노테이션 상태가 "draft" → "confirmed"로 변경
4. 확인된 어노테이션은 Export 시 포함됨
5. 일괄 확인 (Bulk Confirm) 지원

#### 내부 동작

**Frontend (단일 확인):**
```typescript
// RightPanel.tsx - 어노테이션 목록
const handleConfirm = async (annotationId: string) => {
  // POST /api/v1/annotations/{annotation_id}/confirm
  const response = await confirmAnnotation(annotationId);

  // Store 업데이트
  annotationStore.updateAnnotation(annotationId, {
    annotation_state: 'confirmed',
    confirmed_at: response.confirmed_at,
    confirmed_by: response.confirmed_by,
    confirmed_by_name: response.confirmed_by_name,
  });

  toast.success('Annotation confirmed');
};
```

**Backend (단일 확인):**
```python
# POST /api/v1/annotations/{annotation_id}/confirm
@router.post("/{annotation_id}/confirm")
async def confirm_annotation(
    annotation_id: int,
    current_user: User = Depends(get_current_user)
):
    # 1. Annotation 조회
    annotation = labeler_db.query(Annotation).filter(
        Annotation.id == annotation_id
    ).first()
    if not annotation:
        raise HTTPException(404, "Annotation not found")

    # 2. 권한 확인 (reviewer 이상 또는 본인 어노테이션)
    permission = check_permission(annotation.project_id, current_user.id, min_role="annotator")

    # Annotator는 본인 것만 확인 가능
    if permission.role == "annotator" and annotation.created_by != current_user.id:
        raise HTTPException(403, "Cannot confirm others' annotations")

    # 3. 상태 업데이트
    if annotation.annotation_state == "confirmed":
        raise HTTPException(400, "Annotation already confirmed")

    annotation.annotation_state = "confirmed"
    annotation.confirmed_at = datetime.utcnow()
    annotation.confirmed_by = current_user.id

    labeler_db.commit()

    # 4. User 정보 조회 (User DB)
    user = user_db.query(User).filter(User.id == current_user.id).first()

    return {
        "annotation_id": annotation.id,
        "annotation_state": "confirmed",
        "confirmed_at": annotation.confirmed_at.isoformat(),
        "confirmed_by": current_user.id,
        "confirmed_by_name": user.full_name if user else None,
    }
```

**Frontend (일괄 확인):**
```typescript
// RightPanel.tsx
const handleBulkConfirm = async () => {
  // 1. 선택된 어노테이션 ID 수집
  const selectedIds = annotations
    .filter(ann => ann.selected && ann.annotation_state === 'draft')
    .map(ann => ann.id);

  if (selectedIds.length === 0) {
    toast.error('No draft annotations selected');
    return;
  }

  // 2. POST /api/v1/annotations/bulk-confirm
  const response = await bulkConfirmAnnotations(selectedIds);

  // 3. Store 업데이트
  response.results.forEach((result) => {
    if (result.annotation_state === 'confirmed') {
      annotationStore.updateAnnotation(result.annotation_id, {
        annotation_state: 'confirmed',
        confirmed_at: result.confirmed_at,
        // ...
      });
    }
  });

  toast.success(`Confirmed ${response.confirmed} annotations`);
  if (response.failed > 0) {
    toast.error(`Failed: ${response.failed}`);
  }
};
```

**Backend (일괄 확인):**
```python
# POST /api/v1/annotations/bulk-confirm
@router.post("/bulk-confirm")
async def bulk_confirm_annotations(
    request: BulkConfirmRequest,
    current_user: User = Depends(get_current_user)
):
    results = []
    errors = []
    confirmed_count = 0
    failed_count = 0

    for annotation_id in request.annotation_ids:
        try:
            # 단일 확인 로직 재사용
            result = await confirm_annotation(annotation_id, current_user)
            results.append(result)
            confirmed_count += 1
        except Exception as e:
            errors.append(f"Annotation {annotation_id}: {str(e)}")
            failed_count += 1

    return {
        "confirmed": confirmed_count,
        "failed": failed_count,
        "results": results,
        "errors": errors,
    }
```

**데이터 흐름:**
```
[단일 확인]
  → Frontend: 어노테이션 목록에서 Confirm 버튼 클릭
  → POST /api/v1/annotations/{id}/confirm
  → Backend: 권한 확인 (reviewer 또는 본인) → annotation_state = "confirmed" → confirmed_at, confirmed_by 설정
  → Frontend: Store 업데이트 → UI 업데이트 (confirmed 뱃지 표시)

[일괄 확인]
  → Frontend: 여러 어노테이션 선택 → Bulk Confirm 버튼
  → POST /api/v1/annotations/bulk-confirm (annotation_ids[])
  → Backend: 각 어노테이션에 대해 확인 로직 실행 → 성공/실패 집계
  → Frontend: 결과에 따라 Store 업데이트 → Toast 알림
```

---

### 8. 실시간 협업 - Image Lock 시스템 (Phase 8.5)

#### 시나리오
1. 사용자 A가 이미지 선택 시 자동으로 락 획득
2. 사용자 B가 같은 이미지 선택 시 "Locked by User A" 오버레이 표시
3. 사용자 A가 2분마다 Heartbeat 전송하여 락 유지
4. 사용자 A가 다른 이미지로 이동하거나 페이지 떠날 때 락 해제
5. 5분 타임아웃 후 자동 락 해제 (사용자 A가 비정상 종료한 경우)

#### 내부 동작

**Frontend (락 획득):**
```typescript
// Canvas.tsx
useEffect(() => {
  if (!project || !currentImage) return;

  const acquireImageLock = async () => {
    // POST /api/v1/image-locks/acquire
    const result = await imageLockAPI.acquireLock(project.id, currentImage.id);

    if (result.status === 'already_locked' && result.locked_by) {
      // 다른 사용자가 편집 중
      setLockedByUser(result.locked_by.user_name);
      setIsImageLocked(false);
      return;
    }

    // 락 획득 성공
    setIsImageLocked(true);
    setLockedByUser(null);

    // Store에 락 정보 저장
    useAnnotationStore.setState((state) => ({
      projectLocks: [...state.projectLocks.filter(l => l.image_id !== currentImage.id), result.lock],
    }));
  };

  acquireImageLock();

  return () => {
    // 컴포넌트 언마운트 시 락 해제
    if (lockAcquired) {
      imageLockAPI.releaseLock(project.id, currentImage.id);
    }
  };
}, [project, currentImage]);
```

**Frontend (Heartbeat):**
```typescript
// Canvas.tsx
useEffect(() => {
  if (!isImageLocked || !project || !currentImage) return;

  // 2분마다 Heartbeat 전송
  const heartbeatInterval = setInterval(async () => {
    try {
      // POST /api/v1/image-locks/heartbeat
      await imageLockAPI.sendHeartbeat(project.id, currentImage.id);
    } catch (error) {
      console.error('Heartbeat failed:', error);
      // 락이 만료되었거나 다른 문제 발생
      setIsImageLocked(false);
      toast.error('Lock expired. Image is now read-only.');
    }
  }, 2 * 60 * 1000); // 2분

  return () => clearInterval(heartbeatInterval);
}, [isImageLocked, project, currentImage]);
```

**Backend (락 획득):**
```python
# POST /api/v1/image-locks/acquire
@router.post("/acquire")
async def acquire_lock(
    request: LockAcquireRequest,
    current_user: User = Depends(get_current_user)
):
    # 1. 권한 확인 (annotator 이상)
    check_permission(request.project_id, current_user.id, min_role="annotator")

    # 2. 기존 락 조회
    existing_lock = labeler_db.query(ImageLock).filter(
        ImageLock.project_id == request.project_id,
        ImageLock.image_id == request.image_id
    ).first()

    # 3. 락이 없거나 만료된 경우 → 새 락 생성
    if not existing_lock or existing_lock.expires_at < datetime.utcnow():
        if existing_lock:
            labeler_db.delete(existing_lock)

        new_lock = ImageLock(
            project_id=request.project_id,
            image_id=request.image_id,
            user_id=current_user.id,
            lock_type="edit",
            acquired_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(minutes=5),
            last_heartbeat=datetime.utcnow(),
        )
        labeler_db.add(new_lock)
        labeler_db.commit()
        labeler_db.refresh(new_lock)

        return {
            "status": "acquired",
            "lock": new_lock,
            "message": "Lock acquired successfully",
        }

    # 4. 본인이 이미 락을 가지고 있는 경우
    if existing_lock.user_id == current_user.id:
        # Heartbeat 갱신
        existing_lock.last_heartbeat = datetime.utcnow()
        existing_lock.expires_at = datetime.utcnow() + timedelta(minutes=5)
        labeler_db.commit()

        return {
            "status": "already_acquired",
            "lock": existing_lock,
            "message": "You already have the lock",
        }

    # 5. 다른 사용자가 락을 가지고 있는 경우
    lock_holder = user_db.query(User).filter(User.id == existing_lock.user_id).first()

    return {
        "status": "already_locked",
        "locked_by": {
            "user_id": lock_holder.id,
            "user_name": lock_holder.full_name,
            "user_email": lock_holder.email,
        },
        "lock": None,
        "message": f"Image is locked by {lock_holder.full_name}",
    }
```

**Backend (Heartbeat):**
```python
# POST /api/v1/image-locks/heartbeat
@router.post("/heartbeat")
async def send_heartbeat(
    request: LockHeartbeatRequest,
    current_user: User = Depends(get_current_user)
):
    # 1. 락 조회
    lock = labeler_db.query(ImageLock).filter(
        ImageLock.project_id == request.project_id,
        ImageLock.image_id == request.image_id,
        ImageLock.user_id == current_user.id
    ).first()

    if not lock:
        raise HTTPException(404, "Lock not found")

    # 2. Heartbeat 갱신
    lock.last_heartbeat = datetime.utcnow()
    lock.expires_at = datetime.utcnow() + timedelta(minutes=5)
    labeler_db.commit()

    return {"status": "success", "message": "Heartbeat updated"}
```

**Backend (락 해제):**
```python
# POST /api/v1/image-locks/release
@router.post("/release")
async def release_lock(
    request: LockReleaseRequest,
    current_user: User = Depends(get_current_user)
):
    # 1. 락 조회
    lock = labeler_db.query(ImageLock).filter(
        ImageLock.project_id == request.project_id,
        ImageLock.image_id == request.image_id,
        ImageLock.user_id == current_user.id
    ).first()

    if not lock:
        # 이미 해제되었거나 없음
        return {"status": "success", "message": "Lock already released"}

    # 2. 락 삭제
    labeler_db.delete(lock)
    labeler_db.commit()

    return {"status": "success", "message": "Lock released"}
```

**Backend (Strict Lock Policy - Phase 8.5.2):**
```python
# 모든 어노테이션 수정 API에서 락 확인 추가
def check_image_lock(project_id: str, image_id: str, user_id: int):
    """Phase 8.5.2: Strict lock policy - 모든 편집 전 락 확인."""
    lock = labeler_db.query(ImageLock).filter(
        ImageLock.project_id == project_id,
        ImageLock.image_id == image_id
    ).first()

    if not lock:
        raise HTTPException(
            status_code=423,
            detail=f"Image {image_id} is not locked. Please acquire lock before editing."
        )

    if lock.user_id != user_id:
        raise HTTPException(
            status_code=423,
            detail=f"Image {image_id} is locked by another user. Cannot edit."
        )

    # 락 만료 확인
    if lock.expires_at < datetime.utcnow():
        labeler_db.delete(lock)
        labeler_db.commit()
        raise HTTPException(
            status_code=423,
            detail=f"Lock for image {image_id} has expired. Please acquire new lock."
        )

# POST /api/v1/annotations, PUT /api/v1/annotations/{id}, DELETE /api/v1/annotations/{id}
# 모두 check_image_lock() 호출
```

**데이터 흐름:**
```
[이미지 선택 시 락 획득]
  → Frontend: 이미지 클릭 → POST /api/v1/image-locks/acquire
  → Backend: 기존 락 확인 → 없거나 만료 → 새 락 생성 (expires_at: 5분 후)
  → Frontend: isImageLocked = true

[다른 사용자가 같은 이미지 선택]
  → Frontend: 이미지 클릭 → POST /api/v1/image-locks/acquire
  → Backend: 기존 락 존재 & 다른 사용자 → status: "already_locked", locked_by: {...}
  → Frontend: "Locked by User A" 오버레이 표시 → 읽기 전용 모드

[Heartbeat (2분마다)]
  → Frontend: setInterval → POST /api/v1/image-locks/heartbeat
  → Backend: last_heartbeat 갱신, expires_at 연장 (5분 후)
  → 락 유지

[이미지 변경 시 락 해제]
  → Frontend: 이미지 변경 → POST /api/v1/image-locks/release (기존 이미지)
  → Backend: 락 삭제
  → Frontend: 새 이미지 락 획득

[Strict Lock Policy - 어노테이션 수정 시]
  → Frontend: BBox 크기 조정 → PUT /api/v1/annotations/{id}
  → Backend: check_image_lock() → 락 없음 or 다른 사용자 → HTTP 423 에러
  → Frontend: 에러 표시 "Cannot edit: Image is locked by another user"
```

---

## 추가 시나리오

### 9. 이미지 상태 자동 업데이트

- 어노테이션 추가 시: `status = "in-progress"`
- 모든 어노테이션 확인 시: `status = "completed"`
- 어노테이션 삭제 시: `status = "pending"` (어노테이션 0개인 경우)

### 10. 프로젝트 통계 실시간 업데이트

- 어노테이션 추가/삭제 시 `total_annotations` 증감
- 이미지 상태 변경 시 `annotated_images` 증감
- 클래스별 카운트 (`task_classes`의 `bbox_count`, `image_count`) 업데이트

### 11. 권한 기반 UI 제어 (Phase 8.1)

- Viewer: 읽기 전용 (어노테이션 생성/수정 버튼 비활성화)
- Annotator: 본인 어노테이션만 수정 가능
- Reviewer: 모든 어노테이션 수정 + 확인 가능
- Admin: 멤버 관리, 클래스 관리
- Owner: 프로젝트 삭제, 데이터셋 삭제

### 12. Optimistic Locking (Phase 8.5.1)

- 어노테이션 수정 시 `version` 필드 전송
- 백엔드에서 `version` 불일치 시 HTTP 409 Conflict
- Frontend에서 충돌 다이얼로그 표시 (병합 또는 덮어쓰기 선택)

---

## 성능 최적화

### Phase 2.12: Image Metadata Table
- **문제**: S3 `list_objects` 호출이 느림 (수천 개 이미지 시)
- **해결**: DB에 `image_metadata` 테이블 추가 → `OFFSET/LIMIT` 쿼리로 빠른 페이지네이션
- **효과**: 10배 이상 속도 향상

### Canvas 렌더링 최적화
- **requestAnimationFrame**: 부드러운 애니메이션
- **Debounce**: Resize, Pan 이벤트
- **Offscreen Canvas**: 복잡한 어노테이션 사전 렌더링 (필요시)

### Zustand Immer 미들웨어
- 불변성 자동 관리로 성능 향상 및 버그 감소

---

## 보안

### 인증 (Authentication)
- JWT 토큰 기반 인증
- `access_token` localStorage 저장
- 토큰 만료 시 자동 로그아웃

### 인가 (Authorization)
- 모든 API 엔드포인트에서 권한 확인 (`check_permission`)
- RBAC (Role-Based Access Control) 5단계

### 데이터 보호
- S3 Presigned URL (1시간 만료)
- 이미지 직접 접근 불가
- CORS 설정

---

## 마무리

이 문서는 MVP Vision AI Labeler의 전체 아키텍쳐와 주요 사용자 시나리오를 상세히 설명합니다. 각 시나리오별로 Frontend와 Backend의 내부 동작, API 호출 흐름, 데이터베이스 쿼리를 포함하여 시스템의 전체적인 작동 방식을 이해할 수 있습니다.

주요 특징:
- **협업 중심**: Image Lock 시스템으로 실시간 협업 지원
- **권한 관리**: 5단계 RBAC로 세밀한 권한 제어
- **성능**: DB 기반 페이지네이션, Canvas 최적화
- **확장성**: 모듈화된 코드 구조, API 기반 아키텍쳐
- **안정성**: Undo/Redo, Optimistic Locking, Strict Lock Policy

향후 개선 방향:
- WebSocket 기반 실시간 동기화
- 자동 저장 (Autosave)
- AI 기반 자동 어노테이션 제안
- 멀티플레이어 실시간 편집 (Google Docs 스타일)
