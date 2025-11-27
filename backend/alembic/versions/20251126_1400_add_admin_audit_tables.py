"""add admin audit tables for Phase 15

Revision ID: 20251126_1400
Revises: 20251124_0000
Create Date: 2025-11-26 14:00:00.000000

Description:
    Phase 15.1 - Admin Dashboard & Audit System

    Creates three tables in Labeler DB for admin functionality:
    1. audit_logs - Comprehensive audit trail for all system actions
    2. user_sessions - User session tracking for analytics
    3. system_stats_cache - Pre-calculated statistics cache

    CONSTRAINT: UserDB cannot be modified (platform team ownership)
    DECISION: All audit data stored in Labeler DB with cross-DB queries for user info

    Features:
    - Complete audit trail (create/update/delete/auth events)
    - Session duration tracking
    - Statistics caching with TTL
    - Optimized indexes for common queries
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '20251126_1400'
down_revision = '20251124_0000'
branch_labels = None
depends_on = None


def upgrade():
    """Create admin audit tables."""

    # 1. Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.BigInteger(), nullable=False, autoincrement=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('user_id', sa.Integer(), nullable=True),  # Nullable for system events
        sa.Column('action', sa.String(length=100), nullable=False),  # 'create', 'update', 'delete', 'login', etc.
        sa.Column('resource_type', sa.String(length=50), nullable=True),  # 'dataset', 'project', 'annotation', etc.
        sa.Column('resource_id', sa.String(length=255), nullable=True),  # ID of the affected resource
        sa.Column('details', postgresql.JSONB(), nullable=True),  # Additional context
        sa.Column('ip_address', postgresql.INET(), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('session_id', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='success'),  # 'success', 'failure', 'error'
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for audit_logs (optimized for common queries)
    op.create_index('ix_audit_logs_timestamp', 'audit_logs', ['timestamp'], postgresql_using='btree')
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_logs_resource', 'audit_logs', ['resource_type', 'resource_id'])
    op.create_index('ix_audit_logs_status', 'audit_logs', ['status'])
    op.create_index('ix_audit_logs_session_id', 'audit_logs', ['session_id'])

    # 2. Create user_sessions table
    op.create_table(
        'user_sessions',
        sa.Column('id', sa.BigInteger(), nullable=False, autoincrement=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.String(length=255), nullable=False),
        sa.Column('login_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('logout_at', sa.DateTime(), nullable=True),
        sa.Column('last_activity_at', sa.DateTime(), nullable=True),
        sa.Column('ip_address', postgresql.INET(), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),  # Calculated on logout
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for user_sessions
    op.create_index('ix_user_sessions_session_id', 'user_sessions', ['session_id'], unique=True)
    op.create_index('ix_user_sessions_user_id', 'user_sessions', ['user_id'])
    op.create_index('ix_user_sessions_login_at', 'user_sessions', ['login_at'], postgresql_using='btree')

    # 3. Create system_stats_cache table
    op.create_table(
        'system_stats_cache',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('metric_name', sa.String(length=100), nullable=False),  # e.g., 'total_users', 'active_datasets'
        sa.Column('metric_value', postgresql.JSONB(), nullable=False),  # Flexible JSON structure
        sa.Column('calculated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(), nullable=True),  # TTL support
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for system_stats_cache
    op.create_index('ix_system_stats_cache_metric_name', 'system_stats_cache', ['metric_name'])
    op.create_index('ix_system_stats_cache_expires_at', 'system_stats_cache', ['expires_at'])
    op.create_index('ix_system_stats_cache_calculated_at', 'system_stats_cache', ['calculated_at'], postgresql_using='btree')


def downgrade():
    """Drop admin audit tables."""

    # Drop system_stats_cache
    op.drop_index('ix_system_stats_cache_calculated_at', table_name='system_stats_cache')
    op.drop_index('ix_system_stats_cache_expires_at', table_name='system_stats_cache')
    op.drop_index('ix_system_stats_cache_metric_name', table_name='system_stats_cache')
    op.drop_table('system_stats_cache')

    # Drop user_sessions
    op.drop_index('ix_user_sessions_login_at', table_name='user_sessions')
    op.drop_index('ix_user_sessions_user_id', table_name='user_sessions')
    op.drop_index('ix_user_sessions_session_id', table_name='user_sessions')
    op.drop_table('user_sessions')

    # Drop audit_logs
    op.drop_index('ix_audit_logs_session_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_status', table_name='audit_logs')
    op.drop_index('ix_audit_logs_resource', table_name='audit_logs')
    op.drop_index('ix_audit_logs_action', table_name='audit_logs')
    op.drop_index('ix_audit_logs_user_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_timestamp', table_name='audit_logs')
    op.drop_table('audit_logs')
