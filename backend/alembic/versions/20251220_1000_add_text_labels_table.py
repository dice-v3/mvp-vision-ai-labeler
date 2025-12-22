"""Add text_labels table for VLM text labeling (Phase 19)

Revision ID: 20251220_1000
Revises: 20251130_1600
Create Date: 2025-12-20 10:00:00.000000

Description:
    Phase 19 - VLM Text Labeling

    Adds text_labels table for Vision-Language Model training datasets.

    Supports:
    - Image-level labels (captions, descriptions, VQA)
    - Region-level labels (bbox/polygon text descriptions)

    Design:
    - annotation_id NULL → image-level label
    - annotation_id set → region-level label (linked to bbox/polygon)

    Features:
    - Multi-language support
    - Full-text search capability (indexes prepared)
    - Optimistic locking (version column)
    - RBAC integration (created_by, updated_by)

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251220_1000'
down_revision = '20251130_1600'
branch_labels = None
depends_on = None


def upgrade():
    """Create text_labels table for Phase 19 (VLM Text Labeling)."""

    op.create_table(
        'text_labels',
        # Primary key
        sa.Column('id', sa.BigInteger(), nullable=False, autoincrement=True),

        # Foreign keys (no actual FK constraints - different databases)
        sa.Column('project_id', sa.String(50), nullable=False),
        sa.Column('image_id', sa.String(255), nullable=False),
        sa.Column('annotation_id', sa.BigInteger(), nullable=True),  # NULL = image-level, set = region-level

        # Label type: caption, description, qa, region
        sa.Column('label_type', sa.String(20), nullable=False, server_default='caption'),

        # Text content
        sa.Column('text_content', sa.Text(), nullable=False),
        sa.Column('question', sa.Text(), nullable=True),  # For VQA type

        # Language
        sa.Column('language', sa.String(10), nullable=False, server_default='en'),

        # Confidence/quality (optional)
        sa.Column('confidence', sa.Integer(), nullable=True),

        # Additional metadata
        sa.Column('metadata', postgresql.JSONB(), nullable=False, server_default='{}'),

        # Optimistic locking
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),

        # Audit fields
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),

        sa.PrimaryKeyConstraint('id'),
    )

    # Indexes for efficient querying
    op.create_index('ix_text_labels_project_id', 'text_labels', ['project_id'])
    op.create_index('ix_text_labels_image_id', 'text_labels', ['image_id'])
    op.create_index('ix_text_labels_annotation_id', 'text_labels', ['annotation_id'])
    op.create_index('ix_text_labels_label_type', 'text_labels', ['label_type'])
    op.create_index('ix_text_labels_version', 'text_labels', ['version'])
    op.create_index('ix_text_labels_created_at', 'text_labels', ['created_at'])
    op.create_index('ix_text_labels_created_by', 'text_labels', ['created_by'])

    # Compound indexes for common query patterns
    op.create_index('ix_text_labels_project_image', 'text_labels', ['project_id', 'image_id'])
    op.create_index('ix_text_labels_project_type', 'text_labels', ['project_id', 'label_type'])
    op.create_index('ix_text_labels_language', 'text_labels', ['language'])

    # Note: Full-text search indexes (GIN) can be added later if needed
    # Example (requires pg_trgm extension):
    # op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm;')
    # op.execute('CREATE INDEX ix_text_labels_fts_content ON text_labels USING gin(text_content gin_trgm_ops);')
    # op.execute('CREATE INDEX ix_text_labels_fts_question ON text_labels USING gin(question gin_trgm_ops);')


def downgrade():
    """Remove text_labels table."""

    # Drop indexes
    op.drop_index('ix_text_labels_language', table_name='text_labels')
    op.drop_index('ix_text_labels_project_type', table_name='text_labels')
    op.drop_index('ix_text_labels_project_image', table_name='text_labels')
    op.drop_index('ix_text_labels_created_by', table_name='text_labels')
    op.drop_index('ix_text_labels_created_at', table_name='text_labels')
    op.drop_index('ix_text_labels_version', table_name='text_labels')
    op.drop_index('ix_text_labels_label_type', table_name='text_labels')
    op.drop_index('ix_text_labels_annotation_id', table_name='text_labels')
    op.drop_index('ix_text_labels_image_id', table_name='text_labels')
    op.drop_index('ix_text_labels_project_id', table_name='text_labels')

    # Drop table
    op.drop_table('text_labels')
