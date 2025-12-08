#!/usr/bin/env python3
"""
Database Initialization Script

Initializes Labeler database schema and optionally creates sample data.

Usage:
    python scripts/init_database.py                    # Initialize schema only
    python scripts/init_database.py --with-sample     # Initialize + sample data
    python scripts/init_database.py --reset           # Drop all + reinitialize (DANGEROUS!)
"""

import argparse
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError

from app.core.config import settings


def get_db_url():
    """Get Labeler database URL from settings."""
    return (
        f"postgresql://{settings.LABELER_DB_USER}:{settings.LABELER_DB_PASSWORD}"
        f"@{settings.LABELER_DB_HOST}:{settings.LABELER_DB_PORT}/{settings.LABELER_DB_NAME}"
    )


def check_database_connection():
    """Check if database is accessible."""
    print("=" * 80)
    print("Database Connection Check")
    print("=" * 80)

    db_url = get_db_url()
    print(f"Database: {settings.LABELER_DB_HOST}:{settings.LABELER_DB_PORT}/{settings.LABELER_DB_NAME}")
    print(f"User: {settings.LABELER_DB_USER}")

    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            print(f"✓ Connection successful!")
            print(f"  PostgreSQL version: {version.split(',')[0]}")
            return True
    except OperationalError as e:
        print(f"✗ Connection failed: {e}")
        print("\nPlease check:")
        print("1. PostgreSQL is running")
        print("2. Database credentials in .env are correct")
        print("3. Database 'labeler' exists")
        print("\nTo create database:")
        print(f"  createdb -h {settings.LABELER_DB_HOST} -p {settings.LABELER_DB_PORT} -U {settings.LABELER_DB_USER} {settings.LABELER_DB_NAME}")
        return False


def check_existing_schema():
    """Check if schema already exists."""
    db_url = get_db_url()
    engine = create_engine(db_url)
    inspector = inspect(engine)

    tables = inspector.get_table_names()
    if tables:
        print(f"\n⚠️  Database already has {len(tables)} tables:")
        for table in sorted(tables)[:10]:  # Show first 10
            print(f"  - {table}")
        if len(tables) > 10:
            print(f"  ... and {len(tables) - 10} more")
        return True
    return False


def drop_all_tables():
    """Drop all tables (DANGEROUS!)."""
    print("\n" + "=" * 80)
    print("⚠️  WARNING: This will DELETE ALL DATA in Labeler database!")
    print("=" * 80)

    response = input("Type 'DELETE ALL DATA' to confirm: ")
    if response != "DELETE ALL DATA":
        print("Cancelled.")
        return False

    db_url = get_db_url()
    engine = create_engine(db_url)

    print("\nDropping all tables...")
    with engine.begin() as conn:
        # Drop alembic_version first
        conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE"))

        # Get all tables
        inspector = inspect(engine)
        tables = inspector.get_table_names()

        for table in tables:
            print(f"  Dropping {table}...")
            conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))

    print("✓ All tables dropped")
    return True


def run_migrations():
    """Run Alembic migrations to create schema."""
    print("\n" + "=" * 80)
    print("Running Database Migrations")
    print("=" * 80)

    # Get alembic.ini path
    backend_dir = Path(__file__).parent.parent
    alembic_ini = backend_dir / "alembic.ini"

    if not alembic_ini.exists():
        print(f"✗ alembic.ini not found at {alembic_ini}")
        return False

    print(f"Using config: {alembic_ini}")

    # Create Alembic config
    alembic_cfg = Config(str(alembic_ini))

    # Override database URL
    db_url = get_db_url()
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    try:
        # Run migrations
        print("\nRunning: alembic upgrade head")
        command.upgrade(alembic_cfg, "head")
        print("\n✓ Migrations completed successfully")
        return True
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def verify_schema():
    """Verify that all expected tables exist."""
    print("\n" + "=" * 80)
    print("Schema Verification")
    print("=" * 80)

    expected_tables = [
        "datasets",
        "dataset_permissions",
        "annotation_projects",
        "annotations",
        "annotation_versions",
        "image_annotation_status",
        "image_locks",
        "project_permissions",
        "invitations",
        "audit_logs",
        "user_sessions",
        "system_stats_cache",
        "image_metadata",
    ]

    db_url = get_db_url()
    engine = create_engine(db_url)
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    print(f"Expected tables: {len(expected_tables)}")
    print(f"Existing tables: {len(existing_tables)}")
    print()

    missing = []
    for table in expected_tables:
        if table in existing_tables:
            print(f"  ✓ {table}")
        else:
            print(f"  ✗ {table} (MISSING)")
            missing.append(table)

    if missing:
        print(f"\n⚠️  {len(missing)} tables are missing!")
        return False

    print("\n✓ All expected tables exist")
    return True


def check_current_migration():
    """Check current migration version."""
    db_url = get_db_url()
    engine = create_engine(db_url)

    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            version = result.fetchone()
            if version:
                print(f"\nCurrent migration: {version[0]}")
                return version[0]
            else:
                print("\nNo migration applied yet")
                return None
    except Exception:
        print("\nAlembic version table not found (first run)")
        return None


def create_sample_data():
    """Create sample data for testing (optional)."""
    print("\n" + "=" * 80)
    print("Creating Sample Data")
    print("=" * 80)

    print("\n⚠️  Sample data creation not implemented yet.")
    print("This is optional and can be added later if needed.")
    print("\nFor now, you can:")
    print("1. Start the backend server")
    print("2. Use the API to create projects and annotations")
    print("3. Or import data from Platform")


def main():
    """Main initialization flow."""
    parser = argparse.ArgumentParser(description="Initialize Labeler database")
    parser.add_argument(
        "--with-sample",
        action="store_true",
        help="Create sample data after initialization"
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="⚠️  Drop all tables before initialization (DANGEROUS!)"
    )
    args = parser.parse_args()

    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 20 + "Labeler Database Initialization" + " " * 27 + "║")
    print("╚" + "=" * 78 + "╝")
    print()

    # Step 1: Check connection
    if not check_database_connection():
        sys.exit(1)

    # Step 2: Check existing schema
    has_schema = check_existing_schema()

    # Step 3: Handle reset if requested
    if args.reset:
        if has_schema:
            if not drop_all_tables():
                sys.exit(1)
        else:
            print("\nDatabase is already empty, skipping drop.")

    # Step 4: Check if we need to initialize
    if has_schema and not args.reset:
        print("\n" + "=" * 80)
        print("Existing Schema Detected")
        print("=" * 80)
        print("\nOptions:")
        print("1. Run migrations to update schema:     alembic upgrade head")
        print("2. Reset and reinitialize (DANGEROUS):  python scripts/init_database.py --reset")
        print("3. Check current migration version:     alembic current")
        print()

        check_current_migration()

        response = input("\nContinue anyway? (y/N): ")
        if response.lower() != 'y':
            print("Cancelled.")
            sys.exit(0)

    # Step 5: Run migrations
    if not run_migrations():
        sys.exit(1)

    # Step 6: Verify schema
    if not verify_schema():
        print("\n⚠️  Schema verification failed!")
        print("Some tables may be missing. Check migration logs above.")
        sys.exit(1)

    # Step 7: Show current migration version
    check_current_migration()

    # Step 8: Create sample data (optional)
    if args.with_sample:
        create_sample_data()

    # Success!
    print("\n" + "╔" + "=" * 78 + "╗")
    print("║" + " " * 25 + "✓ Initialization Complete!" + " " * 28 + "║")
    print("╚" + "=" * 78 + "╝")
    print()
    print("Next steps:")
    print("1. Start backend:  uvicorn app.main:app --reload --host 0.0.0.0 --port 8001")
    print("2. API Docs:       http://localhost:8001/docs")
    print("3. Start frontend: cd frontend && npm run dev")
    print()


if __name__ == "__main__":
    main()
