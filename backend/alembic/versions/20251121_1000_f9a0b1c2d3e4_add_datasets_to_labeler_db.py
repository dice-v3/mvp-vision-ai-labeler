"""Add datasets and dataset_permissions to Labeler DB

Revision ID: f9a0b1c2d3e4
Revises: e4f5a6b7c8d9
Create Date: 2025-11-21 10:00:00.000000

IMPORTANT: This migration moves dataset ownership to Labeler DB.
- Creates datasets table in Labeler DB
- Creates dataset_permissions table in Labeler DB
- Adds foreign key constraints from annotation_projects and images to datasets
- Platform DB will only be used for users table (read-only)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f9a0b1c2d3e4'
down_revision = 'refactoring_001'  # Updated to point to latest refactoring migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Migrate datasets ownership to Labeler DB.

    Creates:
    1. datasets table (moved from Platform DB)
    2. dataset_permissions table (moved from Platform DB)
    3. Foreign key constraints
    """

    # =========================================================================
    # 1. Create datasets table in Labeler DB
    # =========================================================================
    op.create_table(
        'datasets',

        # Primary key
        sa.Column('id', sa.String(100), primary_key=True),

        # Basic info
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('owner_id', sa.String(length=36), nullable=False),  # References Platform users.id (NO FK, different DB) - index created below

        # Dataset configuration
        sa.Column('visibility', sa.String(20), nullable=False, server_default='private'),
        sa.Column('tags', sa.Text, nullable=True),  # JSON stored as Text

        # Storage information
        sa.Column('storage_path', sa.String(500), nullable=False),
        sa.Column('storage_type', sa.String(20), nullable=False, server_default='s3'),

        # Dataset format and content
        sa.Column('format', sa.String(50), nullable=False, server_default='images'),
        sa.Column('labeled', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('annotation_path', sa.String(500), nullable=True),

        # Statistics
        sa.Column('num_classes', sa.Integer, nullable=True),
        sa.Column('num_images', sa.Integer, nullable=False, server_default='0'),
        sa.Column('class_names', sa.Text, nullable=True),  # JSON stored as Text

        # Snapshot info
        sa.Column('is_snapshot', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('parent_dataset_id', sa.String(100), nullable=True),
        sa.Column('snapshot_created_at', sa.DateTime, nullable=True),
        sa.Column('version_tag', sa.String(50), nullable=True),

        # Status and integrity
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('integrity_status', sa.String(20), nullable=False, server_default='valid'),

        # Versioning
        sa.Column('version', sa.Integer, nullable=False, server_default='1'),
        sa.Column('content_hash', sa.String(64), nullable=True),
        sa.Column('last_modified_at', sa.DateTime, nullable=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('NOW()')),

        # Split configuration
        sa.Column('split_config', sa.Text, nullable=True),  # JSON stored as Text
    )

    # Create indexes for datasets
    op.create_index('ix_datasets_owner_id', 'datasets', ['owner_id'])
    op.create_index('ix_datasets_status', 'datasets', ['status'])
    op.create_index('ix_datasets_created_at', 'datasets', ['created_at'])
    op.create_index('ix_datasets_owner_created', 'datasets', ['owner_id', 'created_at'])

    # =========================================================================
    # 2. Create dataset_permissions table in Labeler DB
    # =========================================================================
    op.create_table(
        'dataset_permissions',

        # Primary key
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),

        # Foreign keys
        sa.Column('dataset_id', sa.String(100), nullable=False),  # Index created below
        sa.Column('user_id', sa.String(length=36), nullable=False),  # References Platform users.id (NO FK, different DB) - index created below

        # Permission info
        sa.Column('role', sa.String(20), nullable=False),  # 'owner' or 'member'
        sa.Column('granted_by', sa.String(length=36), nullable=False),  # User ID who granted this permission
        sa.Column('granted_at', sa.DateTime, nullable=False, server_default=sa.text('NOW()')),

        # Constraints
        sa.ForeignKeyConstraint(
            ['dataset_id'],
            ['datasets.id'],
            name='fk_dataset_permissions_dataset',
            ondelete='CASCADE'
        ),
        sa.UniqueConstraint('dataset_id', 'user_id', name='uq_dataset_user'),
        sa.CheckConstraint(
            "role IN ('owner', 'member')",
            name='ck_dataset_permissions_role'
        ),
    )

    # Create indexes for dataset_permissions
    op.create_index('ix_dataset_permissions_dataset', 'dataset_permissions', ['dataset_id'])
    op.create_index('ix_dataset_permissions_user', 'dataset_permissions', ['user_id'])
    op.create_index('ix_dataset_permissions_role', 'dataset_permissions', ['role'])

    # =========================================================================
    # 3. Add foreign key constraints to existing tables
    # =========================================================================
    #
    # NOTE: FK constraints are COMMENTED OUT for initial migration.
    # This is because existing annotation_projects may reference datasets
    # that don't exist yet in the new datasets table.
    #
    # To add FK constraints after cleaning up data:
    # 1. Delete all annotation_projects records (or ensure datasets exist)
    # 2. Run a separate migration to add FK constraints
    #
    # Uncomment the code below when ready:
    #
    # # Add FK from annotation_projects.dataset_id to datasets.id
    # op.create_foreign_key(
    #     'fk_annotation_projects_dataset',
    #     'annotation_projects',
    #     'datasets',
    #     ['dataset_id'],
    #     ['id'],
    #     ondelete='CASCADE'
    # )
    #
    # # Add FK from images.dataset_id to datasets.id (if images table exists)
    # try:
    #     op.create_foreign_key(
    #         'fk_images_dataset',
    #         'images',
    #         'datasets',
    #         ['dataset_id'],
    #         ['id'],
    #         ondelete='CASCADE'
    #     )
    # except Exception as e:
    #     print(f"Warning: Could not create FK on images.dataset_id: {e}")

    print("[OK] datasets and dataset_permissions tables created successfully!")
    print("[WARNING] Foreign key constraints NOT added yet (commented out)")
    print("         Add FKs after cleaning up existing annotation_projects data")


def downgrade() -> None:
    """
    Rollback datasets ownership to Platform DB.

    WARNING: This will drop all datasets and permissions data in Labeler DB!
    """

    # Drop foreign key constraints first
    try:
        op.drop_constraint('fk_images_dataset', 'images', type_='foreignkey')
    except Exception:
        pass

    op.drop_constraint('fk_annotation_projects_dataset', 'annotation_projects', type_='foreignkey')

    # Drop dataset_permissions table
    op.drop_index('ix_dataset_permissions_role', table_name='dataset_permissions')
    op.drop_index('ix_dataset_permissions_user', table_name='dataset_permissions')
    op.drop_index('ix_dataset_permissions_dataset', table_name='dataset_permissions')
    op.drop_table('dataset_permissions')

    # Drop datasets table
    op.drop_index('ix_datasets_owner_created', table_name='datasets')
    op.drop_index('ix_datasets_created_at', table_name='datasets')
    op.drop_index('ix_datasets_status', table_name='datasets')
    op.drop_index('ix_datasets_owner_id', table_name='datasets')
    op.drop_table('datasets')
