"""add_task_type_to_versions

Revision ID: c8d9e0f1a2b3
Revises: b7f3a9d4e2c1
Create Date: 2025-11-18 00:00:00.000000

Phase 2.9: Task-based Annotation Architecture
- Add task_type column to annotation_versions table
- Update unique index to include task_type (project_id, task_type, version_number)
- Migrate existing data to use first task from project's task_types
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c8d9e0f1a2b3'
down_revision: Union[str, None] = 'b7f3a9d4e2c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Add task_type column (nullable initially for data migration)
    op.add_column(
        'annotation_versions',
        sa.Column('task_type', sa.String(length=20), nullable=True)
    )

    # Step 2: Populate task_type from project's first task_type
    # This assumes projects have task_types array in annotation_projects table
    op.execute("""
        UPDATE annotation_versions av
        SET task_type = (
            SELECT task_types[1]
            FROM annotation_projects ap
            WHERE ap.id = av.project_id
        )
        WHERE av.task_type IS NULL
    """)

    # Step 3: Make task_type non-nullable
    op.alter_column(
        'annotation_versions',
        'task_type',
        nullable=False
    )

    # Step 4: Drop old unique index (project_id, version_number)
    op.drop_index('ix_annotation_versions_project_version', table_name='annotation_versions')

    # Step 5: Create new unique index (project_id, task_type, version_number)
    op.create_index(
        'ix_annotation_versions_project_task_version',
        'annotation_versions',
        ['project_id', 'task_type', 'version_number'],
        unique=True
    )

    # Step 6: Add regular index on task_type for filtering
    op.create_index(
        'ix_annotation_versions_task_type',
        'annotation_versions',
        ['task_type']
    )


def downgrade() -> None:
    # Drop new indexes
    op.drop_index('ix_annotation_versions_task_type', table_name='annotation_versions')
    op.drop_index('ix_annotation_versions_project_task_version', table_name='annotation_versions')

    # Restore old unique index
    op.create_index(
        'ix_annotation_versions_project_version',
        'annotation_versions',
        ['project_id', 'version_number'],
        unique=True
    )

    # Drop task_type column
    op.drop_column('annotation_versions', 'task_type')
