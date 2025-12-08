"""add published_task_types to datasets table for Phase 16.6

Revision ID: 20251130_1600
Revises: 20251126_1400
Create Date: 2025-11-30 16:00:00.000000

Description:
    Phase 16.6 - Task-Type-Specific Dataset Query

    Adds published_task_types array column to datasets table.
    This tracks which task types have been published for each dataset
    (e.g., ['detection', 'segmentation', 'classification']).

    Platform team can now query datasets filtered by task_type:
    GET /api/v1/platform/datasets?task_type=segmentation&labeled=true
    → Returns only datasets with 'segmentation' in published_task_types

    Benefits:
    - One dataset can be published with multiple task types
    - Platform gets only relevant datasets for each training job
    - Tracks publish history per task type
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '20251130_1600'
down_revision = '20251126_1400'
branch_labels = None
depends_on = None


def upgrade():
    """Add published_task_types array column to datasets table."""
    # Add published_task_types column (nullable initially for existing rows)
    op.add_column(
        'datasets',
        sa.Column(
            'published_task_types',
            postgresql.ARRAY(sa.String(length=20)),
            nullable=True,  # Allow NULL for existing rows
            server_default='{}',  # Default to empty array
        )
    )

    # Update existing rows to have empty array instead of NULL
    op.execute("UPDATE datasets SET published_task_types = '{}' WHERE published_task_types IS NULL")

    # Now make it NOT NULL with default empty array
    op.alter_column('datasets', 'published_task_types', nullable=False)

    # Create index for task_type filtering (speeds up Platform queries)
    op.create_index(
        'ix_datasets_published_task_types',
        'datasets',
        ['published_task_types'],
        unique=False,
        postgresql_using='gin',  # GIN index for array containment queries
    )


def downgrade():
    """Remove published_task_types column."""
    op.drop_index('ix_datasets_published_task_types', table_name='datasets')
    op.drop_column('datasets', 'published_task_types')
