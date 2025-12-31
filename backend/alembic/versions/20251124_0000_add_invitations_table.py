"""add invitations table for Phase 8.2

Revision ID: 20251124_0000
Revises: 20251123_1000_add_project_permissions_table
Create Date: 2025-11-24 00:00:00.000000

Description:
    Phase 8.2 - Invitation System

    Creates invitations table in Labeler DB for managing project invitations.
    Independent from Platform's invitation system.

    Features:
    - Token-based invitation system
    - 5-role RBAC support (owner/admin/reviewer/annotator/viewer)
    - Expiration tracking (7-day default)
    - Status tracking (pending/accepted/expired/cancelled)
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '20251124_0000'
down_revision = 'i3j4k5l6m7n8'
branch_labels = None
depends_on = None


def upgrade():
    """Create invitations table."""
    op.create_table(
        'invitations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('project_id', sa.String(length=50), nullable=False),
        sa.Column('inviter_id', sa.String(length=36), nullable=False),
        sa.Column('invitee_id', sa.String(length=36), nullable=False),
        sa.Column('invitee_email', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('accepted_at', sa.DateTime(), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for common queries
    op.create_index('ix_invitations_token', 'invitations', ['token'], unique=True)
    op.create_index('ix_invitations_project_id', 'invitations', ['project_id'])
    op.create_index('ix_invitations_inviter_id', 'invitations', ['inviter_id'])
    op.create_index('ix_invitations_invitee_id', 'invitations', ['invitee_id'])
    op.create_index('ix_invitations_status', 'invitations', ['status'])
    op.create_index('ix_invitations_invitee_email', 'invitations', ['invitee_email'])


def downgrade():
    """Drop invitations table."""
    op.drop_index('ix_invitations_invitee_email', table_name='invitations')
    op.drop_index('ix_invitations_status', table_name='invitations')
    op.drop_index('ix_invitations_invitee_id', table_name='invitations')
    op.drop_index('ix_invitations_inviter_id', table_name='invitations')
    op.drop_index('ix_invitations_project_id', table_name='invitations')
    op.drop_index('ix_invitations_token', table_name='invitations')
    op.drop_table('invitations')
