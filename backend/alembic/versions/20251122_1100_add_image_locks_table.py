"""Add image_locks table for concurrent editing protection

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2025-11-22 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'h2i3j4k5l6m7'
down_revision = 'g1h2i3j4k5l6'
branch_labels = None
depends_on = None


def upgrade():
    """Create image_locks table for Phase 8.5.2 (Image Locks)."""

    op.create_table(
        'image_locks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.String(50), nullable=False),
        sa.Column('image_id', sa.String(255), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('locked_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('heartbeat_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'image_id', name='uq_project_image_lock'),
    )

    # Indexes for faster queries
    op.create_index('ix_image_locks_project_id', 'image_locks', ['project_id'])
    op.create_index('ix_image_locks_user_id', 'image_locks', ['user_id'])
    op.create_index('ix_image_locks_expires_at', 'image_locks', ['expires_at'])


def downgrade():
    """Remove image_locks table."""

    op.drop_index('ix_image_locks_expires_at', table_name='image_locks')
    op.drop_index('ix_image_locks_user_id', table_name='image_locks')
    op.drop_index('ix_image_locks_project_id', table_name='image_locks')
    op.drop_table('image_locks')
