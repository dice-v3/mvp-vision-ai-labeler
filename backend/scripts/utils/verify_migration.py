"""
Verify migration results by querying project_permissions table.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.db.models.labeler import ProjectPermission, AnnotationProject
from app.db.models.platform import User
from app.core.database import get_platform_db

# Create database engines
labeler_engine = create_engine(settings.LABELER_DB_URL)
platform_engine = create_engine(settings.PLATFORM_DB_URL)

LabelerSession = sessionmaker(bind=labeler_engine)
PlatformSession = sessionmaker(bind=platform_engine)

labeler_db = LabelerSession()
platform_db = PlatformSession()

try:
    print("=" * 70)
    print("Project Permission Verification")
    print("=" * 70)

    # Get all project permissions
    permissions = labeler_db.query(ProjectPermission).all()

    print(f"\nTotal ProjectPermissions: {len(permissions)}\n")

    if permissions:
        print(f"{'ID':<6} {'Project ID':<18} {'User':<25} {'Role':<12} {'Granted At':<20}")
        print("-" * 90)

        for perm in permissions:
            # Get project info
            project = labeler_db.query(AnnotationProject).filter(
                AnnotationProject.id == perm.project_id
            ).first()

            # Get user info (perm.user_id is Keycloak UUID, not User.id)
            user = platform_db.query(User).filter(User.keycloak_id == perm.user_id).first()
            user_name = user.full_name if user else f"User {perm.user_id}"

            # Get granted by user (perm.granted_by is Keycloak UUID, not User.id)
            granted_by_user = platform_db.query(User).filter(User.keycloak_id == perm.granted_by).first()
            granted_by_name = granted_by_user.full_name if granted_by_user else f"User {perm.granted_by}"

            print(f"{perm.id:<6} {perm.project_id[:16]:<18} {user_name[:23]:<25} {perm.role:<12} {str(perm.granted_at)[:19]:<20}")
            print(f"       Dataset: {project.dataset_id if project else 'N/A'}")
            print(f"       Granted by: {granted_by_name}")
            print()

    # Role distribution
    print("=" * 70)
    print("Role Distribution:")
    print("-" * 70)

    from sqlalchemy import func
    role_counts = (
        labeler_db.query(ProjectPermission.role, func.count(ProjectPermission.id))
        .group_by(ProjectPermission.role)
        .all()
    )

    for role, count in role_counts:
        print(f"  {role:<12} {count:>5}")

    print("=" * 70)

finally:
    labeler_db.close()
    platform_db.close()
