"""Add text_label_versions table for Phase 19.8 (Text Label Versioning & Publish Integration)

Revision ID: 20251221_1000
Revises: 20251220_1000
Create Date: 2025-12-21 10:00:00.000000

Description:
    Phase 19.8 - Text Label Versioning & Publish Integration

    Adds text_label_versions table to store immutable snapshots of text labels
    when a version is published. Critical for preventing data loss during
    publish workflow.

    Design:
    - Stores JSONB snapshot of all text labels at publish time
    - One version per project (unique constraint)
    - Supports dual S3 storage strategy:
      - Internal S3: All versions (history)
      - External S3: Latest only (trainer access)

    Features:
    - Immutable versioning (no updates after creation)
    - Computed counts for query performance
    - Timeline queries (list versions chronologically)
    - Publisher tracking (audit trail)

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251221_1000'
down_revision = '20251220_1000'
branch_labels = None
depends_on = None


def upgrade():
    """Create text_label_versions table for Phase 19.8 (Text Label Versioning)."""

    op.create_table(
        'text_label_versions',
        # Primary key
        sa.Column('id', sa.BigInteger(), nullable=False, autoincrement=True),

        # Foreign key (no actual FK constraint - different database)
        sa.Column('project_id', sa.String(50), nullable=False),

        # Version identifier (e.g., "v1.0", "v2.0")
        sa.Column('version', sa.String(20), nullable=False),

        # Snapshot data (immutable) - stores all text labels at publish time
        sa.Column('text_labels_snapshot', postgresql.JSONB(), nullable=False),

        # Metadata
        sa.Column('notes', sa.Text(), nullable=True),  # Optional publish notes
        sa.Column('published_by', sa.Integer(), nullable=False),  # References User DB user.id
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),

        # Computed fields (stored for query performance)
        sa.Column('label_count', sa.Integer(), nullable=False, server_default='0'),  # Total labels in snapshot
        sa.Column('image_level_count', sa.Integer(), nullable=False, server_default='0'),  # Image-level labels
        sa.Column('region_level_count', sa.Integer(), nullable=False, server_default='0'),  # Region-level labels

        sa.PrimaryKeyConstraint('id'),
    )

    # Indexes for efficient querying
    op.create_index('ix_text_label_versions_project_id', 'text_label_versions', ['project_id'])
    op.create_index('ix_text_label_versions_created_at', 'text_label_versions', ['created_at'])
    op.create_index('ix_text_label_versions_published_by', 'text_label_versions', ['published_by'])

    # Compound index for timeline queries (list versions chronologically)
    op.create_index('ix_text_label_versions_project_created', 'text_label_versions', ['project_id', 'created_at'])

    # Unique constraint: one version per project
    op.create_index('uq_text_label_versions_project_version', 'text_label_versions', ['project_id', 'version'], unique=True)


def downgrade():
    """Remove text_label_versions table."""

    # Drop indexes
    op.drop_index('uq_text_label_versions_project_version', table_name='text_label_versions')
    op.drop_index('ix_text_label_versions_project_created', table_name='text_label_versions')
    op.drop_index('ix_text_label_versions_published_by', table_name='text_label_versions')
    op.drop_index('ix_text_label_versions_created_at', table_name='text_label_versions')
    op.drop_index('ix_text_label_versions_project_id', table_name='text_label_versions')

    # Drop table
    op.drop_table('text_label_versions')
