"""add_version_management

Revision ID: b7f3a9d4e2c1
Revises: f8e2a3c4d5b6
Create Date: 2025-11-16 10:00:00.000000

Phase 2.8: Version Management
- Add annotation_versions table for tracking published versions
- Add annotation_snapshots table for storing immutable annotation snapshots
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b7f3a9d4e2c1'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'  # Previous: migrate_existing_data
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create annotation_versions table
    op.create_table(
        'annotation_versions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.String(length=50), nullable=False),
        sa.Column('version_number', sa.String(length=20), nullable=False),
        sa.Column('version_type', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('created_by', sa.String(length=36), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('annotation_count', sa.Integer(), nullable=True),
        sa.Column('image_count', sa.Integer(), nullable=True),
        sa.Column('export_format', sa.String(length=20), nullable=True),
        sa.Column('export_path', sa.Text(), nullable=True),
        sa.Column('download_url', sa.Text(), nullable=True),
        sa.Column('download_url_expires_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for annotation_versions
    op.create_index('ix_annotation_versions_project_id', 'annotation_versions', ['project_id'])
    op.create_index('ix_annotation_versions_project_version', 'annotation_versions', ['project_id', 'version_number'], unique=True)
    op.create_index('ix_annotation_versions_project_type', 'annotation_versions', ['project_id', 'version_type'])

    # Create annotation_snapshots table
    op.create_table(
        'annotation_snapshots',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('version_id', sa.Integer(), nullable=False),
        sa.Column('annotation_id', sa.BigInteger(), nullable=False),
        sa.Column('snapshot_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for annotation_snapshots
    op.create_index('ix_annotation_snapshots_version', 'annotation_snapshots', ['version_id'])
    op.create_index('ix_annotation_snapshots_annotation', 'annotation_snapshots', ['annotation_id'])


def downgrade() -> None:
    # Drop indexes from annotation_snapshots
    op.drop_index('ix_annotation_snapshots_annotation', table_name='annotation_snapshots')
    op.drop_index('ix_annotation_snapshots_version', table_name='annotation_snapshots')

    # Drop annotation_snapshots table
    op.drop_table('annotation_snapshots')

    # Drop indexes from annotation_versions
    op.drop_index('ix_annotation_versions_project_type', table_name='annotation_versions')
    op.drop_index('ix_annotation_versions_project_version', table_name='annotation_versions')
    op.drop_index('ix_annotation_versions_project_id', table_name='annotation_versions')

    # Drop annotation_versions table
    op.drop_table('annotation_versions')
