"""Add project_permissions table for unified RBAC

Revision ID: i3j4k5l6m7n8
Revises: h2i3j4k5l6m7
Create Date: 2025-11-23 10:00:00.000000

Phase 8.1.1: ProjectPermission table creation
- Unified permission system (replaces DatasetPermission)
- 5 roles: owner, admin, reviewer, annotator, viewer
- Project-level permissions (1:1 with Dataset via AnnotationProject)
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = 'i3j4k5l6m7n8'
down_revision = 'h2i3j4k5l6m7'
branch_labels = None
depends_on = None


def upgrade():
    """Create project_permissions table."""
    op.create_table(
        'project_permissions',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('project_id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('granted_by', sa.Integer(), nullable=False),
        sa.Column('granted_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(
            ['project_id'],
            ['annotation_projects.id'],
            name='fk_project_permissions_project',
            ondelete='CASCADE'
        ),
        sa.UniqueConstraint('project_id', 'user_id', name='uq_project_user'),
        sa.CheckConstraint(
            "role IN ('owner', 'admin', 'reviewer', 'annotator', 'viewer')",
            name='ck_project_permissions_role'
        )
    )

    # Create indexes for performance
    op.create_index(
        'ix_project_permissions_project_id',
        'project_permissions',
        ['project_id']
    )
    op.create_index(
        'ix_project_permissions_user_id',
        'project_permissions',
        ['user_id']
    )
    op.create_index(
        'ix_project_permissions_project_user',
        'project_permissions',
        ['project_id', 'user_id']
    )


def downgrade():
    """Drop project_permissions table."""
    op.drop_index('ix_project_permissions_project_user', table_name='project_permissions')
    op.drop_index('ix_project_permissions_user_id', table_name='project_permissions')
    op.drop_index('ix_project_permissions_project_id', table_name='project_permissions')
    op.drop_table('project_permissions')
