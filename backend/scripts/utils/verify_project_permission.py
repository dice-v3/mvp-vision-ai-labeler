"""
Verify project permission exists for a specific project.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.config import settings
from app.db.models.labeler import AnnotationProject, ProjectPermission

def verify_project_permission(project_id: str):
    """Verify that owner permission exists for the given project."""
    engine = create_engine(settings.LABELER_DB_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # Get the project
        project = db.query(AnnotationProject).filter(
            AnnotationProject.id == project_id
        ).first()

        if not project:
            print(f"[ERROR] Project {project_id} not found")
            return

        print(f"\n[PROJECT INFO]")
        print(f"  ID: {project.id}")
        print(f"  Name: {project.name}")
        print(f"  Owner ID: {project.owner_id}")

        # Check for owner permission
        owner_permission = db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project.id,
            ProjectPermission.user_id == project.owner_id,
        ).first()

        if owner_permission:
            print(f"\n[OK] Owner permission exists:")
            print(f"  Permission ID: {owner_permission.id}")
            print(f"  User ID: {owner_permission.user_id}")
            print(f"  Role: {owner_permission.role}")
            print(f"  Granted by: {owner_permission.granted_by}")
        else:
            print(f"\n[ERROR] Owner permission NOT found!")
            print(f"  Need to create permission for user_id={project.owner_id}")

        # List all permissions for this project
        all_permissions = db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project.id
        ).all()

        print(f"\n[ALL PERMISSIONS] ({len(all_permissions)} total)")
        for perm in all_permissions:
            print(f"  - User {perm.user_id}: {perm.role} (granted by {perm.granted_by})")

    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_project_permission.py <project_id>")
        print("Example: python verify_project_permission.py proj_026c67eeafb4")
        sys.exit(1)

    project_id = sys.argv[1]
    print("=" * 60)
    print(f"Verifying Project Permission: {project_id}")
    print("=" * 60)
    verify_project_permission(project_id)
