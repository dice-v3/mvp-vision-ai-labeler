#!/usr/bin/env python3
"""
Database Initialization Script for Vision AI Labeler

This script initializes the Labeler database:
- Runs Alembic migrations or creates tables directly

Note: User authentication is handled by Keycloak.
      User DB is no longer needed.

Usage:
    python init_db.py [OPTIONS]

Options:
    --create-db       Create database if it doesn't exist
    --create-tables   Create tables directly using SQLAlchemy (no Alembic)
    --skip-migration  Skip Alembic migrations
    --wait            Wait for PostgreSQL to be ready (for Docker/K8s)
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from sqlalchemy import create_engine

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.config import settings
from app.core.database import LabelerBase


# =============================================================================
# Utility Functions
# =============================================================================

def print_status(message: str, status: str = "INFO"):
    """Print formatted status message."""
    colors = {
        "INFO": "\033[94m",    # Blue
        "OK": "\033[92m",      # Green
        "WARN": "\033[93m",    # Yellow
        "ERROR": "\033[91m",   # Red
        "RESET": "\033[0m",    # Reset
    }
    color = colors.get(status, colors["INFO"])
    reset = colors["RESET"]
    print(f"{color}[{status}]{reset} {message}")


def check_postgres_connection(host: str, port: int, user: str, password: str, dbname: str = "postgres") -> bool:
    """Check if PostgreSQL server is reachable."""
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname=dbname,
            connect_timeout=5
        )
        conn.close()
        return True
    except psycopg2.OperationalError:
        return False


def wait_for_postgres(host: str, port: int, user: str, password: str, max_retries: int = 30, delay: int = 2):
    """Wait for PostgreSQL to be ready."""
    print_status(f"Waiting for PostgreSQL at {host}:{port}...")

    for i in range(max_retries):
        if check_postgres_connection(host, port, user, password):
            print_status("PostgreSQL is ready!", "OK")
            return True
        print_status(f"Retry {i + 1}/{max_retries}...", "WARN")
        time.sleep(delay)

    print_status("PostgreSQL did not become ready in time", "ERROR")
    return False


def database_exists(host: str, port: int, user: str, password: str, dbname: str) -> bool:
    """Check if database exists."""
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
        exists = cur.fetchone() is not None
        cur.close()
        conn.close()
        return exists
    except psycopg2.Error as e:
        print_status(f"Error checking database existence: {e}", "ERROR")
        return False


def create_database(host: str, port: int, user: str, password: str, dbname: str) -> bool:
    """Create database if it doesn't exist."""
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        # Check if database exists
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
        if cur.fetchone():
            print_status(f"Database '{dbname}' already exists", "OK")
            cur.close()
            conn.close()
            return True

        # Create database
        cur.execute(f'CREATE DATABASE "{dbname}"')
        print_status(f"Database '{dbname}' created successfully", "OK")

        cur.close()
        conn.close()
        return True
    except psycopg2.Error as e:
        print_status(f"Error creating database: {e}", "ERROR")
        return False


# =============================================================================
# Labeler DB Initialization
# =============================================================================

def run_migrations() -> bool:
    """Run Alembic migrations."""
    print_status("Running Alembic migrations...")

    try:
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=Path(__file__).parent,
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            print_status("Migrations completed successfully", "OK")
            if result.stdout:
                print(result.stdout)
            return True
        else:
            print_status("Migration failed", "ERROR")
            if result.stderr:
                print(result.stderr)
            if result.stdout:
                print(result.stdout)
            return False
    except FileNotFoundError:
        print_status("Alembic not found. Make sure it's installed.", "ERROR")
        return False
    except Exception as e:
        print_status(f"Error running migrations: {e}", "ERROR")
        return False


def get_migration_status() -> str:
    """Get current migration status."""
    try:
        result = subprocess.run(
            ["alembic", "current"],
            cwd=Path(__file__).parent,
            capture_output=True,
            text=True
        )
        return result.stdout.strip() if result.returncode == 0 else "Unknown"
    except Exception:
        return "Unknown"


def create_tables_directly() -> bool:
    """Create tables directly using SQLAlchemy models (without Alembic)."""
    print_status("Creating tables directly using SQLAlchemy models...")

    try:
        # Import all models to register them with LabelerBase
        from app.db.models import labeler  # noqa: F401

        # Create engine
        engine = create_engine(
            f"postgresql://{settings.LABELER_DB_USER}:{settings.LABELER_DB_PASSWORD}@"
            f"{settings.LABELER_DB_HOST}:{settings.LABELER_DB_PORT}/{settings.LABELER_DB_NAME}"
        )

        # Create all tables
        LabelerBase.metadata.create_all(engine)

        print_status("Tables created successfully", "OK")
        return True
    except Exception as e:
        print_status(f"Error creating tables: {e}", "ERROR")
        return False


def verify_labeler_tables() -> bool:
    """Verify that required Labeler tables exist."""
    required_tables = [
        "annotation_projects",
        "annotations",
        "annotation_history",
        "datasets",
        "dataset_permissions",
        "annotation_tasks",
        "comments",
        "text_labels",  # Phase 19: VLM Text Labeling
        "text_label_versions",  # Phase 19.8: Text Label Versioning
    ]

    try:
        conn = psycopg2.connect(
            host=settings.LABELER_DB_HOST,
            port=settings.LABELER_DB_PORT,
            user=settings.LABELER_DB_USER,
            password=settings.LABELER_DB_PASSWORD,
            dbname=settings.LABELER_DB_NAME
        )
        cur = conn.cursor()

        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
        """)
        existing_tables = {row[0] for row in cur.fetchall()}

        print_status(f"Found {len(existing_tables)} tables in database")

        missing_tables = []
        for table in required_tables:
            if table in existing_tables:
                print_status(f"  ✓ {table}", "OK")
            else:
                print_status(f"  ✗ {table} (missing)", "WARN")
                missing_tables.append(table)

        cur.close()
        conn.close()

        return len(missing_tables) == 0
    except psycopg2.Error as e:
        print_status(f"Error verifying tables: {e}", "ERROR")
        return False


def init_labeler_db(create_db: bool = False, create_tables: bool = False, skip_migration: bool = False) -> bool:
    """Initialize Labeler DB."""
    print()
    print("=" * 60)
    print("Initializing Labeler DB")
    print("=" * 60)

    print_status("Configuration:")
    print(f"  Host: {settings.LABELER_DB_HOST}")
    print(f"  Port: {settings.LABELER_DB_PORT}")
    print(f"  Database: {settings.LABELER_DB_NAME}")
    print(f"  User: {settings.LABELER_DB_USER}")
    print()

    # Step 1: Create database if requested
    print_status("Step 1: Checking database...")
    if create_db:
        if not create_database(
            settings.LABELER_DB_HOST,
            settings.LABELER_DB_PORT,
            settings.LABELER_DB_USER,
            settings.LABELER_DB_PASSWORD,
            settings.LABELER_DB_NAME
        ):
            return False
    else:
        if not database_exists(
            settings.LABELER_DB_HOST,
            settings.LABELER_DB_PORT,
            settings.LABELER_DB_USER,
            settings.LABELER_DB_PASSWORD,
            settings.LABELER_DB_NAME
        ):
            print_status(f"Database '{settings.LABELER_DB_NAME}' does not exist", "ERROR")
            print_status("Run with --create-db to create it automatically", "INFO")
            return False
        print_status(f"Database '{settings.LABELER_DB_NAME}' exists", "OK")

    # Step 2: Run migrations or create tables directly
    print()
    if create_tables:
        print_status("Step 2: Creating tables directly...")
        if not create_tables_directly():
            return False
    elif not skip_migration:
        print_status("Step 2: Running migrations...")
        current_status = get_migration_status()
        print_status(f"Current migration: {current_status or '(none)'}")
        if not run_migrations():
            return False
    else:
        print_status("Step 2: Skipping migrations (--skip-migration)", "WARN")

    # Step 3: Verify tables
    print()
    print_status("Step 3: Verifying tables...")
    tables_ok = verify_labeler_tables()

    print()
    if tables_ok:
        print_status("Labeler DB initialized successfully!", "OK")
    else:
        print_status("Labeler DB initialized but some tables are missing", "WARN")

    return tables_ok


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Initialize Vision AI Labeler database")
    parser.add_argument("--create-db", action="store_true", help="Create database if not exists")
    parser.add_argument("--create-tables", action="store_true", help="Create tables directly using SQLAlchemy (no Alembic)")
    parser.add_argument("--skip-migration", action="store_true", help="Skip Alembic migrations")
    parser.add_argument("--wait", action="store_true", help="Wait for PostgreSQL to be ready")
    args = parser.parse_args()

    print()
    print("=" * 60)
    print("Vision AI Labeler - Database Initialization")
    print("=" * 60)
    print()
    print_status("Note: User authentication is handled by Keycloak", "INFO")
    print()

    # Wait for PostgreSQL if requested
    if args.wait:
        if not wait_for_postgres(
            settings.LABELER_DB_HOST,
            settings.LABELER_DB_PORT,
            settings.LABELER_DB_USER,
            settings.LABELER_DB_PASSWORD
        ):
            sys.exit(1)

    # Initialize Labeler DB
    success = init_labeler_db(
        create_db=args.create_db,
        create_tables=args.create_tables,
        skip_migration=args.skip_migration
    )

    print()
    print("=" * 60)
    if success:
        print_status("Database initialized successfully!", "OK")
    else:
        print_status("Database initialization failed", "ERROR")
        sys.exit(1)
    print("=" * 60)


if __name__ == "__main__":
    main()
