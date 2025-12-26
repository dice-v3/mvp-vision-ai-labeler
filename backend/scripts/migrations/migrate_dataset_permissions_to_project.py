"""
Migrate DatasetPermission to ProjectPermission (Phase 8.1.2)

This script migrates all permissions from dataset_permissions to project_permissions.

Migration logic:
1. For each DatasetPermission record:
   - Find corresponding AnnotationProject (1:1 relationship)
   - Map role: owner → owner, member → annotator
   - Create ProjectPermission with same metadata (granted_by, granted_at)

Role mapping:
- owner → owner (full control)
- member → annotator (can annotate own work)

Usage:
    python backend/scripts/migrate_dataset_permissions_to_project.py [--dry-run]

Options:
    --dry-run    Show what would be migrated without making changes
"""

import sys
import os
from pathlib import Path

# Add parent directory to path for imports
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.db.models.labeler import DatasetPermission, ProjectPermission, AnnotationProject

# Create database engine and session
engine = create_engine(settings.LABELER_DB_URL)
SessionLocal = sessionmaker(bind=engine)


def migrate_permissions(dry_run=False):
    """Migrate all DatasetPermission records to ProjectPermission."""
    db = SessionLocal()

    try:
        # Get all dataset permissions
        dataset_perms = db.query(DatasetPermission).all()

        print(f"\n{'='*70}")
        print(f"Dataset Permission → Project Permission Migration")
        print(f"{'='*70}")
        print(f"Found {len(dataset_perms)} dataset permission(s) to migrate")
        print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE MIGRATION'}")
        print(f"{'='*70}\n")

        if not dataset_perms:
            print("[OK] No dataset permissions to migrate")
            return

        # Statistics
        migrated_count = 0
        skipped_count = 0
        error_count = 0

        # Role mapping
        role_map = {
            'owner': 'owner',
            'member': 'annotator'
        }

        for perm in dataset_perms:
            try:
                # Find corresponding project
                project = db.query(AnnotationProject).filter(
                    AnnotationProject.dataset_id == perm.dataset_id
                ).first()

                if not project:
                    print(f"[SKIP] No project for dataset {perm.dataset_id}")
                    skipped_count += 1
                    continue

                # Check if permission already exists
                existing = db.query(ProjectPermission).filter(
                    ProjectPermission.project_id == project.id,
                    ProjectPermission.user_id == perm.user_id
                ).first()

                if existing:
                    print(f"[SKIP] Permission already exists for project {project.id}, user {perm.user_id}")
                    skipped_count += 1
                    continue

                # Map role
                new_role = role_map.get(perm.role, 'annotator')

                # Create project permission
                project_perm = ProjectPermission(
                    project_id=project.id,
                    user_id=perm.user_id,
                    role=new_role,
                    granted_by=perm.granted_by,
                    granted_at=perm.granted_at
                )

                if not dry_run:
                    db.add(project_perm)

                print(f"[MIGRATE] dataset {perm.dataset_id[:12]}... -> project {project.id[:12]}...")
                print(f"          user {perm.user_id}, role {perm.role} -> {new_role}")

                migrated_count += 1

            except Exception as e:
                print(f"[ERROR] Failed to migrate permission for dataset {perm.dataset_id}: {e}")
                error_count += 1
                continue

        # Commit if not dry run
        if not dry_run:
            db.commit()
            print(f"\n{'='*70}")
            print("[OK] Migration committed to database")
        else:
            print(f"\n{'='*70}")
            print("[OK] Dry run completed (no changes made)")

        # Print summary
        print(f"{'='*70}")
        print("Migration Summary:")
        print(f"  Total:    {len(dataset_perms)}")
        print(f"  Migrated: {migrated_count}")
        print(f"  Skipped:  {skipped_count}")
        print(f"  Errors:   {error_count}")
        print(f"{'='*70}\n")

        # Verify counts if not dry run
        if not dry_run:
            verify_migration(db)

    except Exception as e:
        print(f"\n[ERROR] Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def verify_migration(db):
    """Verify migration by comparing counts."""
    print("Verification:")

    # Count dataset permissions
    dataset_count = db.query(DatasetPermission).count()
    print(f"  DatasetPermission count:  {dataset_count}")

    # Count project permissions
    project_count = db.query(ProjectPermission).count()
    print(f"  ProjectPermission count:  {project_count}")

    # Count by role
    print("\n  ProjectPermission by role:")
    roles = db.execute(text(
        "SELECT role, COUNT(*) FROM project_permissions GROUP BY role ORDER BY role"
    )).fetchall()

    for role, count in roles:
        print(f"    {role:12} {count:5}")

    print("")


if __name__ == "__main__":
    # Check for dry-run flag
    dry_run = '--dry-run' in sys.argv

    # Run migration
    migrate_permissions(dry_run=dry_run)
