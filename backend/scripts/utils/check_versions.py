"""Check annotation versions and their task_type."""

from app.db.models.labeler import AnnotationVersion
from app.core.database import get_labeler_db

labeler_db = next(get_labeler_db())

try:
    versions = labeler_db.query(AnnotationVersion).filter(
        AnnotationVersion.project_id == 'proj_086e61ad81d2'
    ).all()

    print(f"Total versions: {len(versions)}")
    print("\nVersion details:")
    for v in versions:
        print(f"  {v.version_number}: task_type={v.task_type}, type={v.version_type}, created={v.created_at}")

finally:
    labeler_db.close()
