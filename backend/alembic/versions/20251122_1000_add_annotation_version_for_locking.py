"""Add version field to annotations for optimistic locking

Revision ID: g1h2i3j4k5l6
Revises: e538081f9c62
Create Date: 2025-11-22 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'g1h2i3j4k5l6'
down_revision = 'e538081f9c62'
branch_labels = None
depends_on = None


def upgrade():
    """Add version field to annotations table for Phase 8.5.1 (Optimistic Locking)."""

    # Add version column with default value of 1
    op.add_column('annotations', sa.Column('version', sa.Integer(), nullable=False, server_default='1'))

    # Remove server_default after adding (we only need it for existing rows)
    op.alter_column('annotations', 'version', server_default=None)

    # Add index for faster version lookups
    op.create_index('ix_annotations_version', 'annotations', ['version'], unique=False)


def downgrade():
    """Remove version field from annotations table."""

    # Drop index first
    op.drop_index('ix_annotations_version', table_name='annotations')

    # Drop column
    op.drop_column('annotations', 'version')
