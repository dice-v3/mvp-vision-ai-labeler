"""migrate_existing_annotation_data

Revision ID: a1b2c3d4e5f6
Revises: f8e2a3c4d5b6
Create Date: 2025-11-14 16:01:00.000000

Data Migration for Phase 2.7:
- Set existing annotations to 'confirmed' state
- Create image_annotation_status entries for existing images with annotations
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from sqlalchemy import select, func

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f8e2a3c4d5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Get database connection
    conn = op.get_bind()

    # Step 1: Update all existing annotations to 'confirmed' state
    print("Migrating existing annotations to 'confirmed' state...")
    conn.execute(
        sa.text("""
            UPDATE annotations
            SET annotation_state = 'confirmed'
            WHERE annotation_state = 'draft'
        """)
    )

    # Step 2: Create image_annotation_status entries for images with annotations
    print("Creating image_annotation_status entries...")
    conn.execute(
        sa.text("""
            INSERT INTO image_annotation_status (
                project_id,
                image_id,
                status,
                first_modified_at,
                last_modified_at,
                total_annotations,
                confirmed_annotations,
                draft_annotations,
                is_image_confirmed
            )
            SELECT
                a.project_id,
                a.image_id,
                CASE
                    WHEN COUNT(*) > 0 THEN 'completed'
                    ELSE 'not-started'
                END as status,
                MIN(a.created_at) as first_modified_at,
                MAX(a.updated_at) as last_modified_at,
                COUNT(*) as total_annotations,
                COUNT(*) as confirmed_annotations,  -- All migrated annotations are confirmed
                0 as draft_annotations,
                true as is_image_confirmed  -- Mark existing work as confirmed
            FROM annotations a
            GROUP BY a.project_id, a.image_id
            ON CONFLICT (project_id, image_id) DO NOTHING
        """)
    )

    print("Data migration completed successfully!")


def downgrade() -> None:
    # Get database connection
    conn = op.get_bind()

    # Step 1: Delete all image_annotation_status entries
    print("Removing image_annotation_status entries...")
    conn.execute(
        sa.text("DELETE FROM image_annotation_status")
    )

    # Step 2: Reset annotations to 'draft' state
    print("Resetting annotations to 'draft' state...")
    conn.execute(
        sa.text("""
            UPDATE annotations
            SET annotation_state = 'draft',
                confirmed_at = NULL,
                confirmed_by = NULL
        """)
    )

    print("Data migration rollback completed!")
