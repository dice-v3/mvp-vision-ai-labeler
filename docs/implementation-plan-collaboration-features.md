# Phase 8: Collaboration Features - Implementation Plan

**Project**: Vision AI Labeler - Collaboration System
**Created**: 2025-11-22
**Estimated Duration**: 76 hours (9-10 weeks part-time)
**Status**: Planning

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current System Analysis](#current-system-analysis)
3. [Phase 8.1: RBAC & User Management](#phase-81-rbac--user-management)
4. [Phase 8.2: Task Assignment](#phase-82-task-assignment)
5. [Phase 8.3: Review & Approval](#phase-83-review--approval)
6. [Phase 8.4: Activity Logging](#phase-84-activity-logging)
7. [Phase 8.5: Concurrent Handling](#phase-85-concurrent-handling)
8. [Implementation Timeline](#implementation-timeline)
9. [Testing Strategy](#testing-strategy)
10. [Migration & Deployment](#migration--deployment)

---

## Executive Summary

### Goals

Phase 8 transforms the Vision AI Labeler from a single-user tool into a **collaborative annotation platform** supporting teams of annotators, reviewers, and project managers.

**Key Capabilities**:
- **Multi-user projects** with role-based access control (RBAC)
- **Task assignment** for distributing annotation work
- **Review workflow** for quality control
- **Activity tracking** for project transparency
- **Concurrent editing** safeguards

### Scope

| Component | Effort | Status |
|-----------|--------|--------|
| 8.1 RBAC & User Management | 18h | Pending |
| 8.2 Task Assignment | 18h | Pending |
| 8.3 Review & Approval | 17h | Pending |
| 8.4 Activity Logging | 9h | Pending |
| 8.5 Concurrent Handling | 14h | Pending |
| **Total Core Features** | **76h** | **Pending** |
| Real-time Presence (Optional) | 8h | Deferred |

### Dependencies

✅ **Complete**:
- JWT authentication system
- Dataset-level permissions (owner/member)
- Project ownership tracking
- Annotation history logging
- Two-database architecture (Platform + Labeler)

⏸️ **Required**:
- Phase 7 completion (performance optimization)
- Email service configuration (for notifications)

---

## Current System Analysis

### What We Have

#### Authentication & Authorization
```python
# JWT-based authentication (24h tokens)
current_user = Depends(get_current_user)
admin_user = Depends(get_current_admin_user)

# Dataset-level permissions
permission = Depends(require_dataset_permission("owner"))  # or "member"
```

**User Model** (Platform DB - read-only):
```python
class User:
    id: Integer
    email: String (unique)
    full_name: String
    system_role: String  # 'admin' or 'user'
    is_active: Boolean
    badge_color: String
```

**DatasetPermission Model** (Labeler DB):
```python
class DatasetPermission:
    dataset_id: String (FK)
    user_id: Integer
    role: String  # 'owner' or 'member'
    granted_by: Integer
    granted_at: DateTime
```

#### Existing Models Ready for Phase 8

**AnnotationTask** (model exists, NO API):
```python
class AnnotationTask:
    id: String(50)
    project_id: String(50)
    assignee_id: Integer       # Who's assigned
    reviewer_id: Integer       # Who reviews
    image_ids: ARRAY(String)   # Images in task
    status: String(20)         # pending → in_progress → review → completed
    total_images: Integer
    completed_images: Integer
    due_date: DateTime
```

**Comment** (model exists, NO API):
```python
class Comment:
    project_id: String(50)
    image_id: String(255)
    annotation_id: BigInteger (optional)
    text: Text
    parent_id: BigInteger      # Threading support
    resolved: Boolean
    author_id: Integer
```

**Annotation Tracking**:
```python
class Annotation:
    created_by: Integer
    updated_by: Integer
    annotation_state: String   # 'draft', 'confirmed', 'verified'
    confirmed_by: Integer
    confirmed_at: DateTime
```

### What's Missing

| Feature | Status | Impact |
|---------|--------|--------|
| **Project-level RBAC** | ❌ None | High - Core blocker |
| **Task Assignment API** | ❌ None | High - Core blocker |
| **Review Workflow** | ❌ None | High - Quality control |
| **Activity Logging** | ⚠️ Partial (annotations only) | Medium - Transparency |
| **Concurrent Safeguards** | ❌ None | Medium - Data integrity |
| **Notification System** | ❌ None | Low - UX enhancement |

---

## Phase 8.1: RBAC & User Management

**Effort**: 18 hours
**Goal**: Implement fine-grained role-based access control at the project level

### 8.1.1 Database Schema (4h)

#### New Table: project_permissions

```sql
CREATE TABLE project_permissions (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL REFERENCES annotation_projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,  -- No FK (Platform DB)
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'annotator', 'reviewer', 'viewer')),
    granted_by INTEGER NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_project_user UNIQUE (project_id, user_id)
);

CREATE INDEX ix_project_permissions_project_user ON project_permissions(project_id, user_id);
CREATE INDEX ix_project_permissions_user_role ON project_permissions(user_id, role);
```

#### Role Capabilities

| Role | View | Annotate | Review | Manage Classes | Manage Members | Delete Project |
|------|------|----------|--------|----------------|----------------|----------------|
| **owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **reviewer** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **annotator** | ✅ | ✅ (own only) | ❌ | ❌ | ❌ | ❌ |
| **viewer** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

#### Schema: ProjectPermissionResponse

```python
# backend/app/schemas/permission.py

class ProjectPermissionResponse(BaseModel):
    id: int
    project_id: str
    user_id: int
    role: str
    granted_by: int
    granted_at: datetime

    # Joined from Platform DB
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_badge_color: Optional[str] = None
    granted_by_name: Optional[str] = None

    class Config:
        from_attributes = True

class ProjectPermissionInviteRequest(BaseModel):
    user_email: str
    role: str = Field(..., description="Role: owner, admin, reviewer, annotator, viewer")

    @field_validator('role')
    def validate_role(cls, v):
        if v not in ['owner', 'admin', 'reviewer', 'annotator', 'viewer']:
            raise ValueError('Invalid role')
        return v

class ProjectPermissionUpdateRequest(BaseModel):
    role: str
```

#### Migration Script

```python
# backend/alembic/versions/20251122_add_project_permissions.py

def upgrade():
    # Create project_permissions table
    op.create_table(
        'project_permissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.String(50), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('granted_by', sa.Integer(), nullable=False),
        sa.Column('granted_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['annotation_projects.id'], ondelete='CASCADE'),
        sa.CheckConstraint("role IN ('owner', 'admin', 'annotator', 'reviewer', 'viewer')"),
        sa.UniqueConstraint('project_id', 'user_id', name='uq_project_user')
    )

    op.create_index('ix_project_permissions_project_user', 'project_permissions', ['project_id', 'user_id'])
    op.create_index('ix_project_permissions_user_role', 'project_permissions', ['user_id', 'role'])

    # Migrate existing project owners
    connection = op.get_bind()
    projects = connection.execute(
        "SELECT id, owner_id, created_at FROM annotation_projects"
    ).fetchall()

    for project in projects:
        connection.execute(
            """
            INSERT INTO project_permissions (project_id, user_id, role, granted_by, granted_at)
            VALUES (%s, %s, 'owner', %s, %s)
            """,
            (project.id, project.owner_id, project.owner_id, project.created_at)
        )
```

### 8.1.2 Backend API (8h)

#### Security Dependency

```python
# backend/app/core/security.py

def require_project_permission(required_role: str = "viewer"):
    """
    Check if user has sufficient project permission.

    Role hierarchy (from highest to lowest):
    owner > admin > reviewer > annotator > viewer

    Args:
        required_role: Minimum role required

    Raises:
        403 if user lacks permission or has insufficient role
    """
    ROLE_HIERARCHY = {
        'owner': 5,
        'admin': 4,
        'reviewer': 3,
        'annotator': 2,
        'viewer': 1
    }

    async def check_permission(
        project_id: str,
        current_user: User = Depends(get_current_user),
        labeler_db: Session = Depends(get_labeler_db),
    ):
        # Check project exists
        project = labeler_db.query(AnnotationProject).filter(
            AnnotationProject.id == project_id
        ).first()
        if not project:
            raise HTTPException(404, f"Project {project_id} not found")

        # System admins have full access
        if current_user.is_admin:
            return ProjectPermission(
                project_id=project_id,
                user_id=current_user.id,
                role='owner'
            )

        # Check permission
        permission = labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id,
            ProjectPermission.user_id == current_user.id,
        ).first()

        if not permission:
            raise HTTPException(403, f"No access to project {project_id}")

        # Check role hierarchy
        user_level = ROLE_HIERARCHY.get(permission.role, 0)
        required_level = ROLE_HIERARCHY.get(required_role, 0)

        if user_level < required_level:
            raise HTTPException(
                403,
                f"{required_role.capitalize()} permission required (you are {permission.role})"
            )

        return permission

    return check_permission
```

#### API Endpoints

```python
# backend/app/api/v1/endpoints/project_permissions.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

router = APIRouter()

@router.post("/{project_id}/permissions/invite", response_model=ProjectPermissionResponse)
async def invite_user_to_project(
    project_id: str,
    request: ProjectPermissionInviteRequest,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("admin")),  # Admin+ can invite
):
    """
    Invite a user to the project by email.

    Permissions: admin, owner
    """
    # Find user by email
    user = platform_db.query(User).filter(User.email == request.user_email).first()
    if not user:
        raise HTTPException(404, f"User with email {request.user_email} not found")

    # Check if already has permission
    existing = labeler_db.query(ProjectPermission).filter(
        ProjectPermission.project_id == project_id,
        ProjectPermission.user_id == user.id,
    ).first()
    if existing:
        raise HTTPException(409, f"User already has access (role: {existing.role})")

    # Create permission
    permission = ProjectPermission(
        project_id=project_id,
        user_id=user.id,
        role=request.role,
        granted_by=current_user.id,
    )
    labeler_db.add(permission)
    labeler_db.commit()
    labeler_db.refresh(permission)

    # TODO: Send email notification

    # Join user info for response
    response_dict = {
        **permission.__dict__,
        "user_name": user.full_name,
        "user_email": user.email,
        "user_badge_color": user.badge_color,
        "granted_by_name": current_user.full_name,
    }

    return ProjectPermissionResponse.model_validate(response_dict)


@router.get("/{project_id}/permissions", response_model=List[ProjectPermissionResponse])
async def list_project_permissions(
    project_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("viewer")),  # Any member can view
):
    """
    List all users with access to this project.

    Permissions: viewer, annotator, reviewer, admin, owner
    """
    permissions = labeler_db.query(ProjectPermission).filter(
        ProjectPermission.project_id == project_id
    ).order_by(ProjectPermission.granted_at).all()

    # Join user information from Platform DB
    user_ids = [p.user_id for p in permissions]
    users = {u.id: u for u in platform_db.query(User).filter(User.id.in_(user_ids)).all()}

    # Join granted_by information
    granted_by_ids = [p.granted_by for p in permissions]
    granted_by_users = {u.id: u for u in platform_db.query(User).filter(User.id.in_(granted_by_ids)).all()}

    results = []
    for perm in permissions:
        user = users.get(perm.user_id)
        granted_by = granted_by_users.get(perm.granted_by)

        results.append(ProjectPermissionResponse.model_validate({
            **perm.__dict__,
            "user_name": user.full_name if user else None,
            "user_email": user.email if user else None,
            "user_badge_color": user.badge_color if user else None,
            "granted_by_name": granted_by.full_name if granted_by else None,
        }))

    return results


@router.put("/{project_id}/permissions/{user_id}", response_model=ProjectPermissionResponse)
async def update_project_permission(
    project_id: str,
    user_id: int,
    request: ProjectPermissionUpdateRequest,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("admin")),  # Admin+ can update
):
    """
    Update a user's role in the project.

    Permissions: admin, owner
    """
    permission = labeler_db.query(ProjectPermission).filter(
        ProjectPermission.project_id == project_id,
        ProjectPermission.user_id == user_id,
    ).first()

    if not permission:
        raise HTTPException(404, "Permission not found")

    # Prevent removing last owner
    if permission.role == "owner" and request.role != "owner":
        owner_count = labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id,
            ProjectPermission.role == "owner",
        ).count()
        if owner_count == 1:
            raise HTTPException(400, "Cannot remove last project owner")

    permission.role = request.role
    labeler_db.commit()
    labeler_db.refresh(permission)

    # Join user info
    user = platform_db.query(User).filter(User.id == user_id).first()

    return ProjectPermissionResponse.model_validate({
        **permission.__dict__,
        "user_name": user.full_name if user else None,
        "user_email": user.email if user else None,
        "user_badge_color": user.badge_color if user else None,
    })


@router.delete("/{project_id}/permissions/{user_id}", status_code=204)
async def remove_project_permission(
    project_id: str,
    user_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("admin")),  # Admin+ can remove
):
    """
    Remove a user's access to the project.

    Permissions: admin, owner
    """
    permission = labeler_db.query(ProjectPermission).filter(
        ProjectPermission.project_id == project_id,
        ProjectPermission.user_id == user_id,
    ).first()

    if not permission:
        raise HTTPException(404, "Permission not found")

    # Prevent removing last owner
    if permission.role == "owner":
        owner_count = labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id,
            ProjectPermission.role == "owner",
        ).count()
        if owner_count == 1:
            raise HTTPException(400, "Cannot remove last project owner")

    # Cannot remove yourself
    if user_id == current_user.id:
        raise HTTPException(400, "Cannot remove yourself from project")

    labeler_db.delete(permission)
    labeler_db.commit()

    return None


@router.get("/my-projects", response_model=List[ProjectSummaryResponse])
async def list_my_projects(
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all projects the current user has access to.

    Groups by role and sorts by granted_at DESC.
    """
    permissions = labeler_db.query(ProjectPermission).filter(
        ProjectPermission.user_id == current_user.id
    ).order_by(ProjectPermission.granted_at.desc()).all()

    project_ids = [p.project_id for p in permissions]
    projects = {p.id: p for p in labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id.in_(project_ids)
    ).all()}

    # Get datasets
    dataset_ids = [p.dataset_id for p in projects.values()]
    datasets = {d.id: d for d in labeler_db.query(Dataset).filter(
        Dataset.id.in_(dataset_ids)
    ).all()}

    results = []
    for perm in permissions:
        project = projects.get(perm.project_id)
        dataset = datasets.get(project.dataset_id) if project else None

        if project:
            results.append(ProjectSummaryResponse.model_validate({
                **project.__dict__,
                "dataset_name": dataset.name if dataset else None,
                "my_role": perm.role,
            }))

    return results
```

### 8.1.3 Frontend Components (4h)

#### API Client

```typescript
// frontend/lib/api/projectPermissions.ts

export interface ProjectPermission {
  id: number;
  project_id: string;
  user_id: number;
  role: 'owner' | 'admin' | 'reviewer' | 'annotator' | 'viewer';
  granted_by: number;
  granted_at: string;
  user_name?: string;
  user_email?: string;
  user_badge_color?: string;
  granted_by_name?: string;
}

export async function inviteUserToProject(
  projectId: string,
  email: string,
  role: string
): Promise<ProjectPermission> {
  const res = await fetch(`/api/v1/projects/${projectId}/permissions/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ user_email: email, role }),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listProjectPermissions(
  projectId: string
): Promise<ProjectPermission[]> {
  const res = await fetch(`/api/v1/projects/${projectId}/permissions`, {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateProjectPermission(
  projectId: string,
  userId: number,
  role: string
): Promise<ProjectPermission> {
  const res = await fetch(`/api/v1/projects/${projectId}/permissions/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ role }),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function removeProjectPermission(
  projectId: string,
  userId: number
): Promise<void> {
  const res = await fetch(`/api/v1/projects/${projectId}/permissions/${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${getToken()}` },
  });

  if (!res.ok) throw new Error(await res.text());
}
```

#### Component: ProjectMembersModal

```typescript
// frontend/components/projects/ProjectMembersModal.tsx

'use client';

import { useState, useEffect } from 'react';
import { ProjectPermission, listProjectPermissions, inviteUserToProject, updateProjectPermission, removeProjectPermission } from '@/lib/api/projectPermissions';
import { toast } from '@/lib/stores/toastStore';

interface Props {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  userRole: string; // Current user's role
}

const ROLES = [
  { value: 'owner', label: 'Owner', description: 'Full control' },
  { value: 'admin', label: 'Admin', description: 'Manage members and settings' },
  { value: 'reviewer', label: 'Reviewer', description: 'Review and approve annotations' },
  { value: 'annotator', label: 'Annotator', description: 'Create annotations' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
];

export default function ProjectMembersModal({ projectId, isOpen, onClose, userRole }: Props) {
  const [members, setMembers] = useState<ProjectPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('annotator');
  const [inviting, setInviting] = useState(false);

  const canManage = ['owner', 'admin'].includes(userRole);

  useEffect(() => {
    if (isOpen) loadMembers();
  }, [isOpen, projectId]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await listProjectPermissions(projectId);
      setMembers(data);
    } catch (error) {
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;

    setInviting(true);
    try {
      await inviteUserToProject(projectId, inviteEmail, inviteRole);
      toast.success('User invited successfully');
      setInviteEmail('');
      loadMembers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await updateProjectPermission(projectId, userId, newRole);
      toast.success('Role updated');
      loadMembers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
    }
  };

  const handleRemove = async (userId: number) => {
    if (!confirm('Remove this user from the project?')) return;

    try {
      await removeProjectPermission(projectId, userId);
      toast.success('User removed');
      loadMembers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove user');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Project Members
          </h2>
        </div>

        {/* Invite Section */}
        {canManage && (
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
              >
                {ROLES.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail}
                className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50"
              >
                {inviting ? 'Inviting...' : 'Invite'}
              </button>
            </div>
          </div>
        )}

        {/* Members List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No members yet</div>
          ) : (
            <div className="space-y-3">
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: member.user_badge_color || '#8b5cf6' }}
                    >
                      {member.user_name?.charAt(0).toUpperCase() || '?'}
                    </div>

                    {/* User Info */}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {member.user_name || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {member.user_email}
                      </div>
                    </div>
                  </div>

                  {/* Role & Actions */}
                  <div className="flex items-center gap-2">
                    {canManage ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                      >
                        {ROLES.map(role => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded text-sm">
                        {ROLES.find(r => r.value === member.role)?.label}
                      </span>
                    )}

                    {canManage && (
                      <button
                        onClick={() => handleRemove(member.user_id)}
                        className="px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 8.1.4 Update Existing APIs (2h)

#### Retrofit Permission Checks

```python
# backend/app/api/v1/endpoints/annotations.py

# OLD: Only owner check
@router.post("/", response_model=AnnotationResponse)
async def create_annotation(
    request: AnnotationCreateRequest,
    current_user: User = Depends(get_current_user),
):
    project = labeler_db.query(AnnotationProject).filter_by(id=request.project_id).first()
    if project.owner_id != current_user.id:
        raise HTTPException(403, "Not authorized")

# NEW: Use project permission dependency
@router.post("/", response_model=AnnotationResponse)
async def create_annotation(
    request: AnnotationCreateRequest,
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("annotator")),  # Annotator+ can create
):
    # Permission already checked by dependency
    ...
```

**Endpoints to Update**:
- `POST /annotations` - Require annotator
- `PUT /annotations/{id}` - Require annotator (+ ownership check)
- `DELETE /annotations/{id}` - Require annotator (+ ownership check)
- `POST /annotations/{id}/confirm` - Require reviewer
- `PUT /projects/{id}` - Require admin
- `DELETE /projects/{id}` - Require owner
- `POST /projects/{id}/classes` - Require admin

---

## Phase 8.2: Task Assignment

**Effort**: 18 hours
**Goal**: Enable project managers to distribute annotation work among team members

### 8.2.1 Database Enhancement (2h)

#### Enhance AnnotationTask Model

```python
# backend/app/db/models/labeler.py

class AnnotationTask(LabelerBase):
    __tablename__ = "annotation_tasks"

    id = Column(String(50), primary_key=True, default=lambda: f"task_{uuid.uuid4().hex[:12]}")
    project_id = Column(String(50), nullable=False, index=True)

    # Task metadata
    name = Column(String(255), nullable=False)
    description = Column(Text)
    priority = Column(Integer, default=0)  # NEW: 0=normal, 1=high, 2=urgent
    tags = Column(JSONB, default=list)     # NEW: ['batch-1', 'defects', etc.]

    # Assignment
    assignee_id = Column(Integer, index=True)
    reviewer_id = Column(Integer)
    created_by = Column(Integer, nullable=False)  # NEW: Who created the task

    # Image list
    image_ids = Column(ARRAY(String(255)), default=list)

    # Progress tracking
    total_images = Column(Integer, default=0)
    completed_images = Column(Integer, default=0)

    # Status workflow
    status = Column(
        String(20),
        default='pending',
        nullable=False,
        index=True
    )  # pending → in_progress → review → completed

    # Deadlines
    due_date = Column(DateTime)
    started_at = Column(DateTime)     # NEW: When status changed to in_progress
    completed_at = Column(DateTime)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('ix_annotation_tasks_assignee_status', 'assignee_id', 'status'),
        Index('ix_annotation_tasks_project_status', 'project_id', 'status'),
    )
```

#### Migration Script

```python
# backend/alembic/versions/20251123_enhance_annotation_tasks.py

def upgrade():
    # Add new columns
    op.add_column('annotation_tasks', sa.Column('priority', sa.Integer(), server_default='0'))
    op.add_column('annotation_tasks', sa.Column('tags', JSONB, server_default='[]'))
    op.add_column('annotation_tasks', sa.Column('created_by', sa.Integer()))
    op.add_column('annotation_tasks', sa.Column('started_at', sa.DateTime()))

    # Add index
    op.create_index('ix_annotation_tasks_project_status', 'annotation_tasks', ['project_id', 'status'])

    # Backfill created_by from assignee_id (best guess)
    op.execute("UPDATE annotation_tasks SET created_by = assignee_id WHERE created_by IS NULL")

    # Make created_by non-nullable
    op.alter_column('annotation_tasks', 'created_by', nullable=False)
```

### 8.2.2 Backend API (10h)

#### Schemas

```python
# backend/app/schemas/task.py

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

class TaskCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    image_ids: List[str] = Field(..., min_items=1)
    assignee_id: Optional[int] = None
    reviewer_id: Optional[int] = None
    priority: int = Field(default=0, ge=0, le=2)
    tags: List[str] = Field(default_factory=list)
    due_date: Optional[datetime] = None

class TaskUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[int] = Field(None, ge=0, le=2)
    tags: Optional[List[str]] = None
    due_date: Optional[datetime] = None

class TaskAssignRequest(BaseModel):
    assignee_id: Optional[int] = Field(None, description="User to assign (null to unassign)")
    reviewer_id: Optional[int] = Field(None, description="Reviewer to assign")

class TaskStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="New status: pending, in_progress, review, completed")

    @field_validator('status')
    def validate_status(cls, v):
        if v not in ['pending', 'in_progress', 'review', 'completed']:
            raise ValueError('Invalid status')
        return v

class TaskResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: Optional[str]
    priority: int
    tags: List[str]

    assignee_id: Optional[int]
    reviewer_id: Optional[int]
    created_by: int

    image_ids: List[str]
    total_images: int
    completed_images: int
    progress_percent: int  # Computed field

    status: str
    due_date: Optional[datetime]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    created_at: datetime
    updated_at: datetime

    # Joined user info
    assignee_name: Optional[str] = None
    reviewer_name: Optional[str] = None
    created_by_name: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_progress(cls, task):
        """Add computed progress_percent field."""
        data = {
            **task.__dict__,
            'progress_percent': int((task.completed_images / task.total_images * 100) if task.total_images > 0 else 0)
        }
        return cls.model_validate(data)
```

#### API Endpoints

```python
# backend/app/api/v1/endpoints/tasks.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime

router = APIRouter()

@router.post("/{project_id}/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    project_id: str,
    request: TaskCreateRequest,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("admin")),  # Admin+ can create tasks
):
    """
    Create an annotation task and assign images to a user.

    Permissions: admin, owner
    """
    # Validate image_ids exist in project
    project = labeler_db.query(AnnotationProject).filter_by(id=project_id).first()
    dataset_images = labeler_db.query(ImageMetadata.image_id).filter(
        ImageMetadata.dataset_id == project.dataset_id
    ).all()
    valid_image_ids = {img.image_id for img in dataset_images}

    invalid_ids = [img_id for img_id in request.image_ids if img_id not in valid_image_ids]
    if invalid_ids:
        raise HTTPException(400, f"Invalid image IDs: {invalid_ids}")

    # Validate assignee/reviewer have project access
    if request.assignee_id:
        assignee_perm = labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id,
            ProjectPermission.user_id == request.assignee_id,
        ).first()
        if not assignee_perm:
            raise HTTPException(400, f"User {request.assignee_id} has no project access")

    if request.reviewer_id:
        reviewer_perm = labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id,
            ProjectPermission.user_id == request.reviewer_id,
            ProjectPermission.role.in_(['reviewer', 'admin', 'owner'])
        ).first()
        if not reviewer_perm:
            raise HTTPException(400, f"User {request.reviewer_id} is not a reviewer")

    # Create task
    task = AnnotationTask(
        project_id=project_id,
        name=request.name,
        description=request.description,
        image_ids=request.image_ids,
        total_images=len(request.image_ids),
        assignee_id=request.assignee_id,
        reviewer_id=request.reviewer_id,
        created_by=current_user.id,
        priority=request.priority,
        tags=request.tags,
        due_date=request.due_date,
    )
    labeler_db.add(task)
    labeler_db.commit()
    labeler_db.refresh(task)

    # TODO: Send notification to assignee

    # Join user info
    users = get_users_info(platform_db, [task.assignee_id, task.reviewer_id, task.created_by])

    return TaskResponse.from_orm_with_progress(task).model_copy(update={
        'assignee_name': users.get(task.assignee_id, {}).get('full_name'),
        'reviewer_name': users.get(task.reviewer_id, {}).get('full_name'),
        'created_by_name': users.get(task.created_by, {}).get('full_name'),
    })


@router.get("/{project_id}/tasks", response_model=List[TaskResponse])
async def list_project_tasks(
    project_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    assignee_id: Optional[int] = Query(None, description="Filter by assignee"),
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("viewer")),  # Any member can view
):
    """
    List all tasks in the project.

    Permissions: viewer, annotator, reviewer, admin, owner
    """
    query = labeler_db.query(AnnotationTask).filter(
        AnnotationTask.project_id == project_id
    )

    if status:
        query = query.filter(AnnotationTask.status == status)
    if assignee_id:
        query = query.filter(AnnotationTask.assignee_id == assignee_id)

    tasks = query.order_by(
        AnnotationTask.priority.desc(),
        AnnotationTask.created_at
    ).all()

    # Join user info
    user_ids = set()
    for task in tasks:
        user_ids.update([task.assignee_id, task.reviewer_id, task.created_by])
    user_ids.discard(None)

    users = get_users_info(platform_db, list(user_ids))

    results = []
    for task in tasks:
        results.append(TaskResponse.from_orm_with_progress(task).model_copy(update={
            'assignee_name': users.get(task.assignee_id, {}).get('full_name'),
            'reviewer_name': users.get(task.reviewer_id, {}).get('full_name'),
            'created_by_name': users.get(task.created_by, {}).get('full_name'),
        }))

    return results


@router.get("/tasks/mine", response_model=List[TaskResponse])
async def list_my_tasks(
    status: Optional[str] = Query(None),
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all tasks assigned to the current user.

    Returns tasks where user is assignee OR reviewer.
    """
    query = labeler_db.query(AnnotationTask).filter(
        or_(
            AnnotationTask.assignee_id == current_user.id,
            AnnotationTask.reviewer_id == current_user.id,
        )
    )

    if status:
        query = query.filter(AnnotationTask.status == status)

    tasks = query.order_by(
        AnnotationTask.priority.desc(),
        AnnotationTask.due_date.asc().nullslast(),
        AnnotationTask.created_at
    ).all()

    # Join user info
    user_ids = set()
    for task in tasks:
        user_ids.update([task.assignee_id, task.reviewer_id, task.created_by])
    user_ids.discard(None)

    users = get_users_info(platform_db, list(user_ids))

    results = []
    for task in tasks:
        results.append(TaskResponse.from_orm_with_progress(task).model_copy(update={
            'assignee_name': users.get(task.assignee_id, {}).get('full_name'),
            'reviewer_name': users.get(task.reviewer_id, {}).get('full_name'),
            'created_by_name': users.get(task.created_by, {}).get('full_name'),
        }))

    return results


@router.post("/{project_id}/tasks/{task_id}/assign", response_model=TaskResponse)
async def assign_task(
    project_id: str,
    task_id: str,
    request: TaskAssignRequest,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("admin")),  # Admin+ can assign
):
    """
    Assign or reassign a task to a user.

    Permissions: admin, owner
    """
    task = labeler_db.query(AnnotationTask).filter_by(id=task_id, project_id=project_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    # Validate assignee has permission
    if request.assignee_id:
        perm = labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id,
            ProjectPermission.user_id == request.assignee_id,
        ).first()
        if not perm:
            raise HTTPException(400, f"User {request.assignee_id} has no project access")

    # Validate reviewer has reviewer role
    if request.reviewer_id:
        perm = labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id,
            ProjectPermission.user_id == request.reviewer_id,
            ProjectPermission.role.in_(['reviewer', 'admin', 'owner'])
        ).first()
        if not perm:
            raise HTTPException(400, f"User {request.reviewer_id} is not a reviewer")

    task.assignee_id = request.assignee_id
    task.reviewer_id = request.reviewer_id
    labeler_db.commit()
    labeler_db.refresh(task)

    # TODO: Send notification

    # Join user info
    users = get_users_info(platform_db, [task.assignee_id, task.reviewer_id, task.created_by])

    return TaskResponse.from_orm_with_progress(task).model_copy(update={
        'assignee_name': users.get(task.assignee_id, {}).get('full_name'),
        'reviewer_name': users.get(task.reviewer_id, {}).get('full_name'),
        'created_by_name': users.get(task.created_by, {}).get('full_name'),
    })


@router.put("/{project_id}/tasks/{task_id}/status", response_model=TaskResponse)
async def update_task_status(
    project_id: str,
    task_id: str,
    request: TaskStatusUpdateRequest,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("annotator")),  # Annotator+ can update
):
    """
    Update task status.

    Permissions: annotator (if assigned), admin, owner
    """
    task = labeler_db.query(AnnotationTask).filter_by(id=task_id, project_id=project_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    # Check if user is assignee (or admin/owner via permission dependency)
    user_permission = labeler_db.query(ProjectPermission).filter(
        ProjectPermission.project_id == project_id,
        ProjectPermission.user_id == current_user.id,
    ).first()

    is_assignee = task.assignee_id == current_user.id
    is_admin = user_permission and user_permission.role in ['admin', 'owner']

    if not (is_assignee or is_admin):
        raise HTTPException(403, "Only task assignee or admin can update status")

    # Update status
    old_status = task.status
    task.status = request.status

    # Track timestamps
    if request.status == 'in_progress' and old_status == 'pending':
        task.started_at = datetime.utcnow()
    elif request.status == 'completed':
        task.completed_at = datetime.utcnow()

    labeler_db.commit()
    labeler_db.refresh(task)

    # Join user info
    users = get_users_info(platform_db, [task.assignee_id, task.reviewer_id, task.created_by])

    return TaskResponse.from_orm_with_progress(task).model_copy(update={
        'assignee_name': users.get(task.assignee_id, {}).get('full_name'),
        'reviewer_name': users.get(task.reviewer_id, {}).get('full_name'),
        'created_by_name': users.get(task.created_by, {}).get('full_name'),
    })


@router.delete("/{project_id}/tasks/{task_id}", status_code=204)
async def delete_task(
    project_id: str,
    task_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("admin")),  # Admin+ can delete
):
    """
    Delete a task.

    Permissions: admin, owner
    """
    task = labeler_db.query(AnnotationTask).filter_by(id=task_id, project_id=project_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    labeler_db.delete(task)
    labeler_db.commit()

    return None


# Helper function
def get_users_info(platform_db: Session, user_ids: List[int]) -> dict:
    """Get user info from Platform DB."""
    user_ids = [uid for uid in user_ids if uid is not None]
    if not user_ids:
        return {}

    users = platform_db.query(User).filter(User.id.in_(user_ids)).all()
    return {
        u.id: {'full_name': u.full_name, 'email': u.email, 'badge_color': u.badge_color}
        for u in users
    }
```

### 8.2.3 Assignment Strategies (3h)

#### Round-Robin Assignment

```python
# backend/app/services/task_assignment_service.py

from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from ..db.models.labeler import AnnotationTask, ImageMetadata, ProjectPermission

class TaskAssignmentService:
    """Service for intelligent task assignment."""

    @staticmethod
    def get_eligible_annotators(
        labeler_db: Session,
        project_id: str
    ) -> List[int]:
        """Get list of user IDs with annotator+ role in project."""
        permissions = labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id,
            ProjectPermission.role.in_(['annotator', 'reviewer', 'admin', 'owner'])
        ).all()

        return [p.user_id for p in permissions]

    @staticmethod
    def assign_round_robin(
        labeler_db: Session,
        project_id: str,
        image_ids: List[str],
        batch_size: int = 50,
        created_by: int = None
    ) -> List[AnnotationTask]:
        """
        Distribute images among annotators using round-robin strategy.

        Args:
            project_id: Project ID
            image_ids: Images to assign
            batch_size: Images per task
            created_by: User creating the tasks

        Returns:
            List of created tasks
        """
        annotators = TaskAssignmentService.get_eligible_annotators(labeler_db, project_id)
        if not annotators:
            raise ValueError("No eligible annotators found")

        # Get current workload for each annotator
        workload = {}
        for user_id in annotators:
            pending = labeler_db.query(func.count(AnnotationTask.id)).filter(
                AnnotationTask.project_id == project_id,
                AnnotationTask.assignee_id == user_id,
                AnnotationTask.status.in_(['pending', 'in_progress'])
            ).scalar()
            workload[user_id] = pending

        # Sort annotators by current workload (ascending)
        sorted_annotators = sorted(annotators, key=lambda u: workload[u])

        # Create tasks
        tasks = []
        annotator_idx = 0

        for i in range(0, len(image_ids), batch_size):
            batch = image_ids[i:i+batch_size]
            assignee_id = sorted_annotators[annotator_idx % len(sorted_annotators)]

            task = AnnotationTask(
                project_id=project_id,
                name=f"Batch {i//batch_size + 1}",
                image_ids=batch,
                total_images=len(batch),
                assignee_id=assignee_id,
                created_by=created_by,
            )
            labeler_db.add(task)
            tasks.append(task)

            annotator_idx += 1

        labeler_db.commit()
        return tasks

    @staticmethod
    def assign_by_workload(
        labeler_db: Session,
        project_id: str,
        image_ids: List[str],
        created_by: int = None
    ) -> List[AnnotationTask]:
        """
        Assign all images to the annotator with the least current workload.

        Useful for urgent tasks that need to go to the most available person.
        """
        annotators = TaskAssignmentService.get_eligible_annotators(labeler_db, project_id)
        if not annotators:
            raise ValueError("No eligible annotators found")

        # Find annotator with min workload
        workload = {}
        for user_id in annotators:
            pending = labeler_db.query(func.count(AnnotationTask.id)).filter(
                AnnotationTask.project_id == project_id,
                AnnotationTask.assignee_id == user_id,
                AnnotationTask.status.in_(['pending', 'in_progress'])
            ).scalar()
            workload[user_id] = pending

        assignee_id = min(workload, key=workload.get)

        task = AnnotationTask(
            project_id=project_id,
            name=f"Urgent batch - {len(image_ids)} images",
            image_ids=image_ids,
            total_images=len(image_ids),
            assignee_id=assignee_id,
            created_by=created_by,
            priority=2,  # Urgent
        )
        labeler_db.add(task)
        labeler_db.commit()

        return [task]
```

#### API Endpoint for Auto-Assignment

```python
# backend/app/api/v1/endpoints/tasks.py

@router.post("/{project_id}/tasks/auto-assign", response_model=List[TaskResponse])
async def auto_assign_tasks(
    project_id: str,
    strategy: str = Query("round-robin", description="round-robin or workload"),
    batch_size: int = Query(50, ge=1, le=200),
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("admin")),  # Admin+ can auto-assign
):
    """
    Auto-assign unassigned images to team members.

    Strategies:
    - round-robin: Distribute evenly among annotators
    - workload: Assign to least busy annotator

    Permissions: admin, owner
    """
    # Get all images not in any task
    project = labeler_db.query(AnnotationProject).filter_by(id=project_id).first()
    all_images = labeler_db.query(ImageMetadata.image_id).filter(
        ImageMetadata.dataset_id == project.dataset_id
    ).all()
    all_image_ids = {img.image_id for img in all_images}

    # Get images already in tasks
    tasks = labeler_db.query(AnnotationTask).filter(
        AnnotationTask.project_id == project_id
    ).all()
    assigned_image_ids = set()
    for task in tasks:
        assigned_image_ids.update(task.image_ids)

    # Unassigned images
    unassigned = list(all_image_ids - assigned_image_ids)

    if not unassigned:
        return []

    # Use assignment service
    from ..services.task_assignment_service import TaskAssignmentService

    if strategy == "round-robin":
        created_tasks = TaskAssignmentService.assign_round_robin(
            labeler_db,
            project_id,
            unassigned,
            batch_size,
            current_user.id
        )
    elif strategy == "workload":
        created_tasks = TaskAssignmentService.assign_by_workload(
            labeler_db,
            project_id,
            unassigned,
            current_user.id
        )
    else:
        raise HTTPException(400, f"Invalid strategy: {strategy}")

    # Join user info
    user_ids = set()
    for task in created_tasks:
        user_ids.update([task.assignee_id, task.reviewer_id, task.created_by])
    user_ids.discard(None)

    users = get_users_info(platform_db, list(user_ids))

    results = []
    for task in created_tasks:
        results.append(TaskResponse.from_orm_with_progress(task).model_copy(update={
            'assignee_name': users.get(task.assignee_id, {}).get('full_name'),
            'reviewer_name': users.get(task.reviewer_id, {}).get('full_name'),
            'created_by_name': users.get(task.created_by, {}).get('full_name'),
        }))

    return results
```

### 8.2.4 Frontend Components (3h)

#### Task Management Dashboard

```typescript
// frontend/components/tasks/TaskManagement.tsx

'use client';

import { useState, useEffect } from 'react';
import { listProjectTasks, createTask, assignTask } from '@/lib/api/tasks';
import { toast } from '@/lib/stores/toastStore';

interface Task {
  id: string;
  name: string;
  assignee_name: string;
  status: string;
  progress_percent: number;
  total_images: number;
  completed_images: number;
  due_date?: string;
}

interface Props {
  projectId: string;
  userRole: string;
}

export default function TaskManagement({ projectId, userRole }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const canManage = ['owner', 'admin'].includes(userRole);

  useEffect(() => {
    loadTasks();
  }, [projectId, statusFilter]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await listProjectTasks(projectId, statusFilter === 'all' ? undefined : statusFilter);
      setTasks(data);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Task Management</h2>

        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => {/* Open auto-assign modal */}}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Auto-Assign
            </button>
            <button
              onClick={() => {/* Open create task modal */}}
              className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700"
            >
              Create Task
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'in_progress', 'review', 'completed'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1 rounded ${
              statusFilter === status
                ? 'bg-violet-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No tasks found</div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div
              key={task.id}
              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="font-medium text-lg">{task.name}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Assignee: {task.assignee_name || 'Unassigned'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Progress: {task.completed_images} / {task.total_images} images ({task.progress_percent}%)
                </div>
                {task.due_date && (
                  <div className="text-sm text-red-600">
                    Due: {new Date(task.due_date).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                {/* Progress bar */}
                <div className="w-32">
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-600 transition-all"
                      style={{ width: `${task.progress_percent}%` }}
                    />
                  </div>
                </div>

                {/* Status badge */}
                <span className={`px-3 py-1 rounded text-sm ${
                  task.status === 'completed' ? 'bg-green-100 text-green-800' :
                  task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  task.status === 'review' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Phase 8.3: Review & Approval

**Effort**: 17 hours
**Goal**: Implement quality control workflow with reviewer approval/rejection

### 8.3.1 Database Schema (3h)

#### New Table: review_requests

```sql
CREATE TABLE review_requests (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(50) NOT NULL REFERENCES annotation_tasks(id) ON DELETE CASCADE,
    project_id VARCHAR(50) NOT NULL,
    image_id VARCHAR(255) NOT NULL,

    -- Users involved
    annotator_id INTEGER NOT NULL,
    reviewer_id INTEGER,

    -- Review status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

    -- Review notes
    review_notes TEXT,
    annotations_approved INTEGER[], -- Annotation IDs approved
    annotations_rejected INTEGER[], -- Annotation IDs rejected

    -- Timestamps
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_review_requests_task ON review_requests(task_id);
CREATE INDEX ix_review_requests_reviewer_status ON review_requests(reviewer_id, status);
CREATE INDEX ix_review_requests_annotator ON review_requests(annotator_id);
CREATE INDEX ix_review_requests_project_image ON review_requests(project_id, image_id);
```

#### Model

```python
# backend/app/db/models/labeler.py

class ReviewRequest(LabelerBase):
    __tablename__ = "review_requests"

    id = Column(Integer, primary_key=True)
    task_id = Column(String(50), ForeignKey('annotation_tasks.id', ondelete='CASCADE'), nullable=False, index=True)
    project_id = Column(String(50), nullable=False)
    image_id = Column(String(255), nullable=False, index=True)

    # Users
    annotator_id = Column(Integer, nullable=False, index=True)
    reviewer_id = Column(Integer, index=True)

    # Status
    status = Column(
        String(20),
        default='pending',
        nullable=False,
        index=True
    )

    # Review notes
    review_notes = Column(Text)
    annotations_approved = Column(ARRAY(Integer), default=list)
    annotations_rejected = Column(ARRAY(Integer), default=list)

    # Timestamps
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('ix_review_requests_task', 'task_id'),
        Index('ix_review_requests_reviewer_status', 'reviewer_id', 'status'),
        Index('ix_review_requests_project_image', 'project_id', 'image_id'),
    )
```

### 8.3.2 Backend API (9h)

#### Schemas

```python
# backend/app/schemas/review.py

class ReviewRequestSubmit(BaseModel):
    task_id: str
    image_ids: List[str] = Field(..., min_items=1)

class ReviewApproveRequest(BaseModel):
    notes: Optional[str] = None

class ReviewRejectRequest(BaseModel):
    notes: str = Field(..., min_length=1, description="Rejection reason required")

class ReviewResponse(BaseModel):
    id: int
    task_id: str
    project_id: str
    image_id: str
    annotator_id: int
    reviewer_id: Optional[int]
    status: str
    review_notes: Optional[str]
    annotations_approved: List[int]
    annotations_rejected: List[int]
    submitted_at: datetime
    reviewed_at: Optional[datetime]

    # Joined info
    annotator_name: Optional[str]
    reviewer_name: Optional[str]

    class Config:
        from_attributes = True
```

#### API Endpoints

```python
# backend/app/api/v1/endpoints/reviews.py

@router.post("/submit", response_model=List[ReviewResponse], status_code=201)
async def submit_for_review(
    request: ReviewRequestSubmit,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit images for review.

    Annotator submits their work for review.
    """
    # Validate task
    task = labeler_db.query(AnnotationTask).filter_by(id=request.task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    # Check user is assignee
    if task.assignee_id != current_user.id:
        raise HTTPException(403, "Only task assignee can submit for review")

    # Validate images belong to task
    invalid = [img_id for img_id in request.image_ids if img_id not in task.image_ids]
    if invalid:
        raise HTTPException(400, f"Images not in task: {invalid}")

    # Create review requests
    reviews = []
    for image_id in request.image_ids:
        # Check if already submitted
        existing = labeler_db.query(ReviewRequest).filter(
            ReviewRequest.task_id == task.id,
            ReviewRequest.image_id == image_id,
            ReviewRequest.status == 'pending'
        ).first()
        if existing:
            continue  # Skip already submitted

        review = ReviewRequest(
            task_id=task.id,
            project_id=task.project_id,
            image_id=image_id,
            annotator_id=current_user.id,
            reviewer_id=task.reviewer_id,
        )
        labeler_db.add(review)
        reviews.append(review)

    # Update task status to 'review'
    if task.status == 'in_progress':
        task.status = 'review'

    labeler_db.commit()

    # TODO: Notify reviewer

    # Join user info
    users = get_users_info(platform_db, [current_user.id, task.reviewer_id])

    results = []
    for review in reviews:
        labeler_db.refresh(review)
        results.append(ReviewResponse.model_validate({
            **review.__dict__,
            'annotator_name': users.get(review.annotator_id, {}).get('full_name'),
            'reviewer_name': users.get(review.reviewer_id, {}).get('full_name'),
        }))

    return results


@router.get("/queue", response_model=List[ReviewResponse])
async def get_review_queue(
    status: str = Query("pending", description="pending, approved, or rejected"),
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get review queue for current user (as reviewer).

    Returns reviews assigned to current user.
    """
    reviews = labeler_db.query(ReviewRequest).filter(
        ReviewRequest.reviewer_id == current_user.id,
        ReviewRequest.status == status,
    ).order_by(ReviewRequest.submitted_at).all()

    # Join user info
    user_ids = {r.annotator_id for r in reviews}
    user_ids.add(current_user.id)
    users = get_users_info(platform_db, list(user_ids))

    results = []
    for review in reviews:
        results.append(ReviewResponse.model_validate({
            **review.__dict__,
            'annotator_name': users.get(review.annotator_id, {}).get('full_name'),
            'reviewer_name': users.get(current_user.id, {}).get('full_name'),
        }))

    return results


@router.post("/{review_id}/approve", response_model=ReviewResponse)
async def approve_review(
    review_id: int,
    request: ReviewApproveRequest,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Approve a review request.

    Confirms all annotations for the image.
    """
    review = labeler_db.query(ReviewRequest).filter_by(id=review_id).first()
    if not review:
        raise HTTPException(404, "Review not found")

    # Check user is reviewer
    if review.reviewer_id != current_user.id:
        raise HTTPException(403, "Only assigned reviewer can approve")

    if review.status != 'pending':
        raise HTTPException(400, f"Review already {review.status}")

    # Get all annotations for this image
    annotations = labeler_db.query(Annotation).filter(
        Annotation.project_id == review.project_id,
        Annotation.image_id == review.image_id,
        Annotation.annotation_state == 'draft'  # Only confirm drafts
    ).all()

    # Confirm all annotations
    confirmed_ids = []
    for ann in annotations:
        ann.annotation_state = 'confirmed'
        ann.confirmed_by = current_user.id
        ann.confirmed_at = datetime.utcnow()
        confirmed_ids.append(ann.id)

    # Update review
    review.status = 'approved'
    review.reviewed_at = datetime.utcnow()
    review.review_notes = request.notes
    review.annotations_approved = confirmed_ids

    # Update image status to completed
    status = labeler_db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id == review.project_id,
        ImageAnnotationStatus.image_id == review.image_id,
    ).first()
    if status:
        status.status = 'completed'
        status.is_image_confirmed = True
        status.confirmed_annotations = len(confirmed_ids)

    labeler_db.commit()
    labeler_db.refresh(review)

    # TODO: Notify annotator

    # Join user info
    users = get_users_info(platform_db, [review.annotator_id, current_user.id])

    return ReviewResponse.model_validate({
        **review.__dict__,
        'annotator_name': users.get(review.annotator_id, {}).get('full_name'),
        'reviewer_name': users.get(current_user.id, {}).get('full_name'),
    })


@router.post("/{review_id}/reject", response_model=ReviewResponse)
async def reject_review(
    review_id: int,
    request: ReviewRejectRequest,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reject a review request.

    Sends annotations back to annotator with feedback.
    """
    review = labeler_db.query(ReviewRequest).filter_by(id=review_id).first()
    if not review:
        raise HTTPException(404, "Review not found")

    # Check user is reviewer
    if review.reviewer_id != current_user.id:
        raise HTTPException(403, "Only assigned reviewer can reject")

    if review.status != 'pending':
        raise HTTPException(400, f"Review already {review.status}")

    # Get all annotations for this image
    annotations = labeler_db.query(Annotation).filter(
        Annotation.project_id == review.project_id,
        Annotation.image_id == review.image_id,
    ).all()

    # Update review
    review.status = 'rejected'
    review.reviewed_at = datetime.utcnow()
    review.review_notes = request.notes
    review.annotations_rejected = [ann.id for ann in annotations]

    labeler_db.commit()
    labeler_db.refresh(review)

    # TODO: Notify annotator with rejection notes

    # Join user info
    users = get_users_info(platform_db, [review.annotator_id, current_user.id])

    return ReviewResponse.model_validate({
        **review.__dict__,
        'annotator_name': users.get(review.annotator_id, {}).get('full_name'),
        'reviewer_name': users.get(current_user.id, {}).get('full_name'),
    })
```

### 8.3.3 Frontend Components (5h)

#### Review Queue Component

```typescript
// frontend/components/reviews/ReviewQueue.tsx

'use client';

import { useState, useEffect } from 'react';
import { getReviewQueue, approveReview, rejectReview } from '@/lib/api/reviews';
import { toast } from '@/lib/stores/toastStore';
import { useRouter } from 'next/navigation';

interface Review {
  id: number;
  task_id: string;
  project_id: string;
  image_id: string;
  annotator_name: string;
  submitted_at: string;
}

export default function ReviewQueue() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await getReviewQueue('pending');
      setReviews(data);
    } catch (error) {
      toast.error('Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = (review: Review) => {
    // Navigate to annotation page with review context
    router.push(`/annotate/${review.project_id}?image=${review.image_id}&review=${review.id}`);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Review Queue</h2>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No pending reviews
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <div
              key={review.id}
              onClick={() => handleReviewClick(review)}
              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">Image: {review.image_id}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Annotator: {review.annotator_name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Submitted: {new Date(review.submitted_at).toLocaleString()}
                  </div>
                </div>

                <button className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700">
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Phase 8.4: Activity Logging

**Effort**: 9 hours
**Goal**: Track all project activities for transparency and auditing

### 8.4.1 Database Schema (2h)

#### New Table: activity_log

```sql
CREATE TABLE activity_log (
    id BIGSERIAL PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL,
    entity_type VARCHAR(20) NOT NULL, -- 'annotation', 'task', 'review', 'permission', 'class', 'project'
    entity_id VARCHAR(255),
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'assign', 'approve', 'reject', etc.
    user_id INTEGER NOT NULL,
    metadata JSONB, -- Action-specific data
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_activity_log_project_timestamp ON activity_log(project_id, timestamp DESC);
CREATE INDEX ix_activity_log_user_timestamp ON activity_log(user_id, timestamp DESC);
CREATE INDEX ix_activity_log_entity ON activity_log(entity_type, entity_id);
```

### 8.4.2 Activity Service (4h)

```python
# backend/app/services/activity_service.py

from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, Dict, Any
from ..db.models.labeler import ActivityLog

class ActivityService:
    """Centralized service for logging all project activities."""

    @staticmethod
    def log(
        labeler_db: Session,
        project_id: str,
        entity_type: str,
        action: str,
        user_id: int,
        entity_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ActivityLog:
        """
        Log an activity.

        Args:
            project_id: Project ID
            entity_type: 'annotation', 'task', 'review', 'permission', 'class', 'project'
            action: Action performed
            user_id: User who performed action
            entity_id: ID of affected entity
            metadata: Additional context data
        """
        activity = ActivityLog(
            project_id=project_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            user_id=user_id,
            metadata=metadata or {},
        )
        labeler_db.add(activity)
        # Note: Caller should commit
        return activity

    # Convenience methods for common actions

    @staticmethod
    def log_annotation_create(labeler_db: Session, project_id: str, annotation_id: int, user_id: int):
        return ActivityService.log(
            labeler_db, project_id, 'annotation', 'create', user_id,
            entity_id=str(annotation_id)
        )

    @staticmethod
    def log_task_assign(labeler_db: Session, project_id: str, task_id: str, assignee_id: int, user_id: int):
        return ActivityService.log(
            labeler_db, project_id, 'task', 'assign', user_id,
            entity_id=task_id,
            metadata={'assignee_id': assignee_id}
        )

    @staticmethod
    def log_review_approve(labeler_db: Session, project_id: str, review_id: int, reviewer_id: int):
        return ActivityService.log(
            labeler_db, project_id, 'review', 'approve', reviewer_id,
            entity_id=str(review_id)
        )

    @staticmethod
    def log_permission_grant(labeler_db: Session, project_id: str, target_user_id: int, role: str, granter_id: int):
        return ActivityService.log(
            labeler_db, project_id, 'permission', 'grant', granter_id,
            metadata={'target_user_id': target_user_id, 'role': role}
        )
```

### 8.4.3 Backend API (3h)

```python
# backend/app/api/v1/endpoints/activity.py

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional

router = APIRouter()

@router.get("/{project_id}/activity", response_model=List[ActivityResponse])
async def get_project_activity(
    project_id: str,
    entity_type: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("viewer")),
):
    """
    Get activity feed for a project.

    Permissions: viewer, annotator, reviewer, admin, owner
    """
    query = labeler_db.query(ActivityLog).filter(
        ActivityLog.project_id == project_id
    )

    if entity_type:
        query = query.filter(ActivityLog.entity_type == entity_type)
    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)

    total = query.count()
    activities = query.order_by(ActivityLog.timestamp.desc()).offset(offset).limit(limit).all()

    # Join user info
    user_ids = {a.user_id for a in activities}
    users = get_users_info(platform_db, list(user_ids))

    results = []
    for activity in activities:
        user_info = users.get(activity.user_id, {})
        results.append(ActivityResponse.model_validate({
            **activity.__dict__,
            'user_name': user_info.get('full_name'),
            'user_email': user_info.get('email'),
        }))

    return results


@router.get("/activity/mine", response_model=List[ActivityResponse])
async def get_my_activity(
    days: int = Query(7, ge=1, le=90, description="Last N days"),
    limit: int = Query(50, le=200),
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get current user's activity across all projects.
    """
    since = datetime.utcnow() - timedelta(days=days)

    activities = labeler_db.query(ActivityLog).filter(
        ActivityLog.user_id == current_user.id,
        ActivityLog.timestamp >= since
    ).order_by(ActivityLog.timestamp.desc()).limit(limit).all()

    results = []
    for activity in activities:
        results.append(ActivityResponse.model_validate({
            **activity.__dict__,
            'user_name': current_user.full_name,
            'user_email': current_user.email,
        }))

    return results
```

---

## Phase 8.5: Concurrent Handling

**Effort**: 14 hours
**Goal**: Prevent data loss from concurrent editing

### 8.5.1 Optimistic Locking (6h)

#### Database Changes

```python
# Add version column to Annotation
op.add_column('annotations', sa.Column('version', sa.Integer(), server_default='1'))
```

#### Updated Annotation Update Logic

```python
# backend/app/api/v1/endpoints/annotations.py

@router.put("/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: int,
    request: AnnotationUpdateRequest,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update annotation with optimistic locking.

    Expects `version` in request. Returns 409 if version mismatch.
    """
    annotation = labeler_db.query(Annotation).filter_by(id=annotation_id).first()
    if not annotation:
        raise HTTPException(404, "Annotation not found")

    # Check version (optimistic locking)
    if request.version != annotation.version:
        raise HTTPException(
            409,
            f"Annotation has been modified by another user. " \
            f"Expected version {request.version}, current version {annotation.version}. " \
            f"Please refresh and try again."
        )

    # Update fields
    if request.geometry is not None:
        annotation.geometry = request.geometry
    if request.class_id is not None:
        annotation.class_id = request.class_id
    # ... other fields

    # Increment version
    annotation.version += 1
    annotation.updated_by = current_user.id

    labeler_db.commit()
    labeler_db.refresh(annotation)

    return AnnotationResponse.model_validate(annotation)
```

### 8.5.2 Annotation Locks (8h)

#### Database Schema

```sql
CREATE TABLE annotation_locks (
    id SERIAL PRIMARY KEY,
    annotation_id BIGINT NOT NULL,
    user_id INTEGER NOT NULL,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    heartbeat_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_annotation_lock UNIQUE (annotation_id)
);

CREATE INDEX ix_annotation_locks_user ON annotation_locks(user_id);
CREATE INDEX ix_annotation_locks_expires ON annotation_locks(expires_at);
```

#### Lock Service

```python
# backend/app/services/lock_service.py

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..db.models.labeler import AnnotationLock

class LockService:
    LOCK_DURATION = timedelta(minutes=5)  # Lock expires after 5 min

    @staticmethod
    def acquire_lock(labeler_db: Session, annotation_id: int, user_id: int) -> bool:
        """
        Try to acquire lock on annotation.

        Returns True if lock acquired, False if locked by another user.
        """
        # Clean expired locks
        labeler_db.query(AnnotationLock).filter(
            AnnotationLock.expires_at < datetime.utcnow()
        ).delete()

        # Check existing lock
        existing = labeler_db.query(AnnotationLock).filter_by(annotation_id=annotation_id).first()

        if existing:
            if existing.user_id == user_id:
                # Refresh own lock
                existing.heartbeat_at = datetime.utcnow()
                existing.expires_at = datetime.utcnow() + LockService.LOCK_DURATION
                labeler_db.commit()
                return True
            else:
                # Locked by another user
                return False

        # Create lock
        lock = AnnotationLock(
            annotation_id=annotation_id,
            user_id=user_id,
            expires_at=datetime.utcnow() + LockService.LOCK_DURATION
        )
        labeler_db.add(lock)
        labeler_db.commit()
        return True

    @staticmethod
    def release_lock(labeler_db: Session, annotation_id: int, user_id: int):
        """Release lock if owned by user."""
        labeler_db.query(AnnotationLock).filter(
            AnnotationLock.annotation_id == annotation_id,
            AnnotationLock.user_id == user_id
        ).delete()
        labeler_db.commit()

    @staticmethod
    def heartbeat(labeler_db: Session, annotation_id: int, user_id: int) -> bool:
        """
        Send heartbeat to keep lock alive.

        Returns True if successful, False if lock lost.
        """
        lock = labeler_db.query(AnnotationLock).filter_by(
            annotation_id=annotation_id,
            user_id=user_id
        ).first()

        if not lock:
            return False

        lock.heartbeat_at = datetime.utcnow()
        lock.expires_at = datetime.utcnow() + LockService.LOCK_DURATION
        labeler_db.commit()
        return True
```

#### Lock API

```python
@router.post("/annotations/{annotation_id}/lock", status_code=201)
async def acquire_annotation_lock(
    annotation_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """Acquire editing lock on annotation."""
    from ..services.lock_service import LockService

    success = LockService.acquire_lock(labeler_db, annotation_id, current_user.id)
    if not success:
        # Get lock owner info
        lock = labeler_db.query(AnnotationLock).filter_by(annotation_id=annotation_id).first()
        user = platform_db.query(User).filter_by(id=lock.user_id).first()

        raise HTTPException(
            423,  # Locked
            f"Annotation is being edited by {user.full_name if user else 'another user'}"
        )

    return {"message": "Lock acquired"}


@router.delete("/annotations/{annotation_id}/lock", status_code=204)
async def release_annotation_lock(
    annotation_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """Release editing lock."""
    from ..services.lock_service import LockService
    LockService.release_lock(labeler_db, annotation_id, current_user.id)
    return None


@router.post("/annotations/{annotation_id}/lock/heartbeat", status_code=200)
async def lock_heartbeat(
    annotation_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """Keep lock alive."""
    from ..services.lock_service import LockService

    success = LockService.heartbeat(labeler_db, annotation_id, current_user.id)
    if not success:
        raise HTTPException(410, "Lock has been lost")

    return {"message": "Heartbeat received"}
```

---

## Implementation Timeline

### Week 1-2: Phase 8.1 (RBAC & User Management)
- Database migration for project_permissions
- Backend permission checking system
- API endpoints for permission management
- Frontend member management UI
- Retrofit existing APIs with new permissions

### Week 3-4: Phase 8.2 (Task Assignment)
- Enhance AnnotationTask model
- Task CRUD APIs
- Assignment strategies (round-robin, workload)
- Frontend task management dashboard
- Auto-assignment UI

### Week 5-6: Phase 8.3 (Review & Approval)
- ReviewRequest table and model
- Review submission and approval APIs
- Review queue backend logic
- Frontend review queue component
- Notification system (email + in-app)

### Week 7: Phase 8.4 (Activity Logging)
- ActivityLog table and model
- Activity logging service
- Activity feed APIs
- Frontend activity feed component
- Export functionality

### Week 8-9: Phase 8.5 (Concurrent Handling)
- Optimistic locking (version field)
- AnnotationLock table and service
- Lock acquisition/release APIs
- Frontend lock indicators
- Conflict resolution UI

### Week 10: Integration & Testing
- End-to-end testing
- Performance testing (concurrent users)
- Bug fixes
- Documentation updates

---

## Testing Strategy

### Unit Tests
- Permission checking logic
- Assignment strategies
- Lock acquisition/release
- Activity logging

### Integration Tests
- Full RBAC workflow (invite → assign → annotate → review)
- Concurrent annotation editing
- Task assignment and completion
- Review approval/rejection flow

### Performance Tests
- 100+ concurrent users
- 10K+ tasks
- Lock contention scenarios
- Activity log query performance

### User Acceptance Tests
- Invite team members
- Create and assign tasks
- Annotate assigned images
- Submit for review
- Approve/reject reviews
- View activity feed

---

## Migration & Deployment

### Database Migrations

```bash
# Phase 8.1
alembic revision -m "Add project_permissions table"
alembic upgrade head

# Phase 8.2
alembic revision -m "Enhance annotation_tasks table"
alembic upgrade head

# Phase 8.3
alembic revision -m "Add review_requests table"
alembic upgrade head

# Phase 8.4
alembic revision -m "Add activity_log table"
alembic upgrade head

# Phase 8.5
alembic revision -m "Add annotation versioning and locks"
alembic upgrade head
```

### Backfill Scripts

```python
# Migrate existing project owners to project_permissions
for project in projects:
    permission = ProjectPermission(
        project_id=project.id,
        user_id=project.owner_id,
        role='owner',
        granted_by=project.owner_id,
        granted_at=project.created_at
    )
    db.add(permission)
```

### Feature Flags

```python
# backend/app/core/config.py

class Settings:
    ENABLE_RBAC: bool = True
    ENABLE_TASK_ASSIGNMENT: bool = True
    ENABLE_REVIEW_WORKFLOW: bool = True
    ENABLE_ACTIVITY_LOG: bool = True
    ENABLE_ANNOTATION_LOCKS: bool = True
```

### Rollback Plan

1. Disable feature flags
2. Revert database migrations
3. Deploy previous version
4. Restore permissions from backup

---

## Success Metrics

### Functional Metrics
- [ ] Users can invite team members with appropriate roles
- [ ] Admins can create and assign tasks
- [ ] Annotators see only their assigned images
- [ ] Reviewers can approve/reject work
- [ ] Activity log captures all project actions
- [ ] Concurrent editing conflicts are detected and resolved

### Performance Metrics
- [ ] Permission checks add <10ms overhead
- [ ] Task assignment handles 10K+ images
- [ ] Review queue loads in <500ms
- [ ] Activity feed queries <100ms for 1K events
- [ ] Lock acquisition <50ms

### Adoption Metrics
- [ ] 80%+ of projects use team features within 1 month
- [ ] Average team size: 3-5 members
- [ ] Review workflow used in 60%+ of collaborative projects
- [ ] Activity feed viewed 10+ times per project per week

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|------------|
| Permission system bugs | Extensive testing, role-based test suites |
| Lock contention | Automatic expiration, heartbeat mechanism |
| Performance degradation | Indexing strategy, query optimization |
| Data migration failures | Thorough backfill testing, rollback scripts |

### User Experience Risks

| Risk | Mitigation |
|------|------------|
| Complex role system | Clear documentation, in-app guidance |
| Lost work from concurrent editing | Auto-save, conflict resolution UI |
| Notification fatigue | Configurable notification preferences |
| Learning curve | Onboarding tour, video tutorials |

---

## Future Enhancements

### Phase 8.6: Advanced Features (Optional)
- Real-time presence indicators (WebSocket)
- Advanced notification preferences
- Bulk task operations
- Task templates
- Performance analytics
- Export activity reports (CSV, PDF)

### Phase 8.7: AI-Assisted Review (Optional)
- Auto-quality scoring
- Anomaly detection
- Smart reviewer assignment
- Consensus review (multiple reviewers)

---

## Documentation Requirements

### API Documentation
- [ ] OpenAPI/Swagger specs updated
- [ ] Permission requirements documented per endpoint
- [ ] Example requests/responses
- [ ] Error codes and meanings

### User Documentation
- [ ] Team collaboration guide
- [ ] Role descriptions and capabilities
- [ ] Task assignment tutorial
- [ ] Review workflow guide
- [ ] Activity feed usage

### Developer Documentation
- [ ] Database schema diagrams
- [ ] Permission checking flow
- [ ] Lock mechanism explanation
- [ ] Migration guide

---

## Conclusion

Phase 8 Collaboration Features transforms the Vision AI Labeler into a production-ready team annotation platform. The implementation is structured into 5 logical sub-phases, each building on the previous one:

1. **RBAC** (foundation) → enables team access
2. **Task Assignment** → distributes work
3. **Review Workflow** → ensures quality
4. **Activity Logging** → provides transparency
5. **Concurrent Handling** → protects data integrity

**Total Effort**: 76 hours (9-10 weeks part-time)

**Dependencies**: Phase 7 completion, email service

**Next Steps**: Begin with Phase 8.1 (RBAC) → Create feature branch → Database migration → Backend API → Frontend UI → Testing

---

**End of Implementation Plan**
