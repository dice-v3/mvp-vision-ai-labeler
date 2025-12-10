"""add_task_classes_to_projects

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
Create Date: 2025-11-18 00:01:00.000000

Phase 2.9: Task-based Annotation Architecture
- Add task_classes column to annotation_projects table
- Migrate existing classes data to task_classes structure
- Keep legacy classes field for backward compatibility
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd9e0f1a2b3c4'
down_revision: Union[str, None] = 'c8d9e0f1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Add task_classes column (JSONB)
    op.add_column(
        'annotation_projects',
        sa.Column('task_classes', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}')
    )

    # Step 2: Migrate existing classes to task_classes structure
    # For each project, nest existing classes under the first task_type
    op.execute("""
        UPDATE annotation_projects
        SET task_classes = jsonb_build_object(
            task_types[1],
            classes
        )
        WHERE classes IS NOT NULL AND classes != '{}'::jsonb
    """)


def downgrade() -> None:
    # Drop task_classes column (classes field remains as legacy)
    op.drop_column('annotation_projects', 'task_classes')
