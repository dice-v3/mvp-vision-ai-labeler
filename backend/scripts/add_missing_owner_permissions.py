"""
Add missing owner permissions for existing projects.

This script finds all projects that don't have owner permissions
and creates them based on the project's owner_id field.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.db.models.labeler import AnnotationProject, ProjectPermission


def add_missing_owner_permissions():
    """Add owner permissions for projects that don't have them."""
    # Create engine and session
    engine = create_engine(settings.LABELER_DB_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # Get all projects
        projects = db.query(AnnotationProject).all()
        print(f"Found {len(projects)} projects")

        added_count = 0
        skipped_count = 0

        for project in projects:
            # Check if owner permission already exists
            existing_permission = db.query(ProjectPermission).filter(
                ProjectPermission.project_id == project.id,
                ProjectPermission.user_id == project.owner_id,
            ).first()

            if existing_permission:
                print(f"[OK] Project {project.id} ({project.name}) - Owner permission already exists")
                skipped_count += 1
                continue

            # Create owner permission
            owner_permission = ProjectPermission(
                project_id=project.id,
                user_id=project.owner_id,
                role="owner",
                granted_by=project.owner_id,
            )
            db.add(owner_permission)
            print(f"[ADD] Project {project.id} ({project.name}) - Added owner permission for user {project.owner_id}")
            added_count += 1

        # Commit all changes
        db.commit()
        print(f"\n[SUCCESS] Migration completed!")
        print(f"   - Added: {added_count} owner permissions")
        print(f"   - Skipped: {skipped_count} (already existed)")

    except Exception as e:
        print(f"\n[ERROR] {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Add Missing Owner Permissions")
    print("=" * 60)
    add_missing_owner_permissions()
