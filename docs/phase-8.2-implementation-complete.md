# Phase 8.2 - Invitation System Implementation Complete

**Date**: 2025-11-24
**Status**: ✅ Complete

## Overview

Successfully implemented independent invitation system for Labeler application in Labeler DB, completely separate from Platform's invitation system.

## Critical Architectural Decision

**Problem**: Platform's invitations table uses system roles (admin, manager, advanced_engineer, standard_engineer, guest) which are incompatible with Labeler's project roles (owner, admin, reviewer, annotator, viewer).

**Solution**: Created independent invitations table in Labeler DB with simple string columns (no enums) for full control over project-level permissions.

**Rationale**: Platform's invitation system serves trainer application for organization/project membership, while Labeler needs dataset/project collaboration with annotation-specific roles.

## Database Changes

### Migration Created
- **File**: `backend/alembic/versions/20251124_0000_add_invitations_table.py`
- **Revision**: `20251124_0000`
- **Down Revision**: `i3j4k5l6m7n8` (project_permissions table)
- **Status**: ✅ Successfully applied

### Table Schema: invitations (Labeler DB)

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| token | VARCHAR(255) | Unique invitation token (URL-safe) |
| project_id | VARCHAR(50) | Reference to AnnotationProject.project_id |
| inviter_id | INTEGER | User ID from User DB (who sent invitation) |
| invitee_id | INTEGER | User ID from User DB (who receives invitation) |
| invitee_email | VARCHAR(255) | Email of invitee |
| role | VARCHAR(20) | Project role: owner/admin/reviewer/annotator/viewer |
| status | VARCHAR(20) | Invitation status: pending/accepted/expired/cancelled |
| message | TEXT | Optional message from inviter |
| created_at | TIMESTAMP | When invitation was created |
| expires_at | TIMESTAMP | When invitation expires (default: 7 days) |
| accepted_at | TIMESTAMP | When invitation was accepted (nullable) |
| cancelled_at | TIMESTAMP | When invitation was cancelled (nullable) |

### Indexes
- `ix_invitations_token` - Unique index on token
- `ix_invitations_project_id` - For project-based queries
- `ix_invitations_inviter_id` - For sent invitations lookup
- `ix_invitations_invitee_id` - For received invitations lookup
- `ix_invitations_status` - For status filtering
- `ix_invitations_invitee_email` - For email-based lookup

## Code Changes

### Backend Models

**Updated**: `backend/app/db/models/labeler.py`
- Added `Invitation` model using `LabelerBase`
- Uses simple string columns for role and status (no enums)
- Includes `is_valid` property to check expiration and status
- Location: Lines added at end of file

**Updated**: `backend/app/db/models/user.py`
- Removed Platform's `Invitation` model (incompatible schema)
- Kept only `User` and `Organization` models for User DB access

### Backend Endpoints

**Rewritten**: `backend/app/api/v1/endpoints/invitations.py`
- Changed database: Uses `labeler_db` instead of `user_db` for invitations
- Updated import: `from app.db.models.labeler import Invitation`
- Removed enum conversions (no longer needed)
- Simplified field mappings (direct field names)
- Added `cancelled_at` timestamp support

### Configuration

**Updated**: `backend/app/core/config.py`
- Added `http://localhost:3010` to `CORS_ORIGINS`
- Enables frontend requests from port 3010

## API Endpoints

All endpoints use Labeler DB's invitations table:

### POST /api/v1/invitations
Create new project invitation
- Requires: owner or admin role on project
- Generates: secure random token with 7-day expiration
- Validates: invitee exists, not already member, no duplicate pending invitation

### GET /api/v1/invitations
List invitations (sent or received)
- Query params: `type` (sent/received), `status`, `project_id`
- Returns: enriched data with user/project names

### POST /api/v1/invitations/accept
Accept invitation by token
- Validates: token, expiration, pending status
- Creates: ProjectPermission with specified role
- Updates: invitation status to 'accepted'

### POST /api/v1/invitations/{invitation_id}/cancel
Cancel pending invitation
- Allowed: inviter or invitee
- Updates: status to 'cancelled', sets cancelled_at

## Issues Fixed During Implementation

### 1. Login Error - is_verified Column
- **Error**: `column users.is_verified does not exist`
- **Cause**: Added field that doesn't exist in Platform's User DB
- **Fix**: Removed from User model and schema

### 2. CORS Blocking
- **Error**: CORS policy blocked localhost:3010
- **Fix**: Added port 3010 to CORS_ORIGINS

### 3. Schema Discovery Process
Used PostgreSQL system tables to discover Platform's actual schema:
- `information_schema.columns` - column details
- `pg_type` and `pg_enum` - enum values
- Discovered: UPPERCASE enum values, system roles incompatibility

### 4. Migration Dependency
- **Error**: `KeyError: '20251123_1000'`
- **Cause**: Used filename as revision ID instead of actual revision ID
- **Fix**: Changed down_revision to 'i3j4k5l6m7n8'

## Testing

### Verified
- ✅ Migration applied successfully
- ✅ Table created with correct schema
- ✅ Invitation model imports successfully
- ✅ Endpoint router loads correctly
- ✅ Database connection works
- ✅ All 13 columns present and correct types

### Ready for Frontend Integration
- Backend endpoints operational
- Database schema complete
- CORS configured for frontend port 3010

## Database Separation Architecture

### User DB (Platform - Port 5433)
- **Purpose**: User authentication and organization management
- **Tables Used**: users, organizations
- **Access**: Read-only from Labeler

### Labeler DB (Port 5435)
- **Purpose**: Annotation project management
- **Tables Used**:
  - annotation_projects
  - project_permissions
  - invitations (NEW)
  - annotations
  - image_locks
- **Access**: Full read/write from Labeler

## Key Features

1. **Token-Based Security**: URL-safe random tokens (32 bytes)
2. **5-Role RBAC**: owner, admin, reviewer, annotator, viewer
3. **Auto-Expiration**: 7-day default, checked on acceptance
4. **Status Tracking**: pending → accepted/expired/cancelled
5. **Duplicate Prevention**: One pending invitation per user per project
6. **Permission Enforcement**: Only owner/admin can invite
7. **Cross-DB Enrichment**: Fetches user names from User DB

## Files Modified

### Backend
- `backend/app/db/models/labeler.py` (added Invitation model)
- `backend/app/db/models/user.py` (removed Platform Invitation model)
- `backend/app/api/v1/endpoints/invitations.py` (rewritten for Labeler DB)
- `backend/app/core/config.py` (added CORS origin)
- `backend/alembic/versions/20251124_0000_add_invitations_table.py` (new migration)

### Documentation
- Created diagnostic scripts for schema discovery
- This implementation summary

## Next Steps

1. Test invitation workflow end-to-end
2. Verify frontend can create/list/accept/cancel invitations
3. Monitor for any runtime errors
4. Consider adding email notifications (future enhancement)

## Notes

- Platform's invitations table remains untouched and unused by Labeler
- Complete independence from Platform's invitation system
- Simple string columns provide flexibility for future role changes
- No database constraints on role values (validated in application layer)
