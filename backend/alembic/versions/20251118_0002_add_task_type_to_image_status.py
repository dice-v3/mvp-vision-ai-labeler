"""add_task_type_to_image_status

Revision ID: e4f5a6b7c8d9
Revises: c8d9e0f1a2b3
Create Date: 2025-11-18 00:02:00.000000

Phase 2.9: Task-based Annotation Architecture
- Add task_type column to image_annotation_status table
- Update unique index to include task_type (project_id, image_id, task_type)
- Migrate existing status records by duplicating them for each task in the project
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, None] = 'd9e0f1a2b3c4'  # Depends on add_task_classes_to_projects
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Drop old unique constraint if it exists
    # First check if the constraint exists
    connection = op.get_bind()
    result = connection.execute(sa.text("""
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'image_annotation_status'
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'uq_project_image_status'
    """))
    if result.fetchone():
        op.drop_constraint('uq_project_image_status', 'image_annotation_status', type_='unique')

    # Step 2: Add task_type column (nullable for backward compatibility and data migration)
    op.add_column(
        'image_annotation_status',
        sa.Column('task_type', sa.String(length=50), nullable=True)
    )

    # Step 3: Add index on task_type for filtering
    op.create_index(
        'ix_image_annotation_status_task_type',
        'image_annotation_status',
        ['task_type']
    )

    # Step 4: Migrate existing data
    # For each existing status record, create a copy for each task type in the project
    # We keep the original record with NULL task_type for backward compatibility
    # and add new records with specific task_type values
    op.execute("""
        INSERT INTO image_annotation_status (
            project_id,
            image_id,
            task_type,
            status,
            first_modified_at,
            last_modified_at,
            confirmed_at,
            total_annotations,
            confirmed_annotations,
            draft_annotations,
            is_image_confirmed
        )
        SELECT DISTINCT
            ias.project_id,
            ias.image_id,
            task_type_elem AS task_type,
            ias.status,
            ias.first_modified_at,
            ias.last_modified_at,
            ias.confirmed_at,
            ias.total_annotations,
            ias.confirmed_annotations,
            ias.draft_annotations,
            ias.is_image_confirmed
        FROM image_annotation_status ias
        CROSS JOIN LATERAL unnest(
            (SELECT task_types FROM annotation_projects WHERE id = ias.project_id)
        ) AS task_type_elem
        WHERE ias.task_type IS NULL
    """)

    # Step 5: Create new unique index (project_id, image_id, task_type)
    # Note: This will be unique even with NULL task_type due to SQL NULL behavior
    op.create_index(
        'ix_image_annotation_status_project_image_task',
        'image_annotation_status',
        ['project_id', 'image_id', 'task_type'],
        unique=True
    )


def downgrade() -> None:
    # Drop new indexes
    op.drop_index('ix_image_annotation_status_project_image_task', table_name='image_annotation_status')
    op.drop_index('ix_image_annotation_status_task_type', table_name='image_annotation_status')

    # Remove task-specific records (keep only NULL task_type records)
    op.execute("""
        DELETE FROM image_annotation_status
        WHERE task_type IS NOT NULL
    """)

    # Drop task_type column
    op.drop_column('image_annotation_status', 'task_type')

    # Restore old unique constraint
    op.create_unique_constraint(
        'uq_project_image_status',
        'image_annotation_status',
        ['project_id', 'image_id']
    )
