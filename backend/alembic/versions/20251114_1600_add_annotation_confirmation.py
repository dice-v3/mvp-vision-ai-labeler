"""add_annotation_confirmation

Revision ID: f8e2a3c4d5b6
Revises: ead03dbc7300
Create Date: 2025-11-14 16:00:00.000000

Phase 2.7: Image & Annotation Confirmation
- Add image_annotation_status table for tracking image status
- Add annotation_state, confirmed_at, confirmed_by to annotations table
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f8e2a3c4d5b6'
down_revision: Union[str, None] = 'ead03dbc7300'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create image_annotation_status table
    op.create_table(
        'image_annotation_status',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.String(length=50), nullable=False),
        sa.Column('image_id', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='not-started'),
        sa.Column('first_modified_at', sa.DateTime(), nullable=True),
        sa.Column('last_modified_at', sa.DateTime(), nullable=True),
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('total_annotations', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('confirmed_annotations', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('draft_annotations', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_image_confirmed', sa.Boolean(), nullable=False, server_default='false'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'image_id', name='uq_project_image_status')
    )

    # Create indexes
    op.create_index('ix_image_annotation_status_project_id', 'image_annotation_status', ['project_id'])
    op.create_index('ix_image_annotation_status_status', 'image_annotation_status', ['status'])
    op.create_index('ix_image_annotation_status_project_status', 'image_annotation_status', ['project_id', 'status'])

    # Add new columns to annotations table
    op.add_column('annotations', sa.Column('annotation_state', sa.String(length=20), nullable=False, server_default='draft'))
    op.add_column('annotations', sa.Column('confirmed_at', sa.DateTime(), nullable=True))
    op.add_column('annotations', sa.Column('confirmed_by', sa.String(length=36), nullable=True))

    # Create index on annotation_state
    op.create_index('ix_annotations_annotation_state', 'annotations', ['annotation_state'])


def downgrade() -> None:
    # Drop index from annotations
    op.drop_index('ix_annotations_annotation_state', table_name='annotations')

    # Drop columns from annotations table
    op.drop_column('annotations', 'confirmed_by')
    op.drop_column('annotations', 'confirmed_at')
    op.drop_column('annotations', 'annotation_state')

    # Drop indexes from image_annotation_status
    op.drop_index('ix_image_annotation_status_project_status', table_name='image_annotation_status')
    op.drop_index('ix_image_annotation_status_status', table_name='image_annotation_status')
    op.drop_index('ix_image_annotation_status_project_id', table_name='image_annotation_status')

    # Drop image_annotation_status table
    op.drop_table('image_annotation_status')
