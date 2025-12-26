"""Test the versions API response."""

import requests

# You may need to get a valid token first
# For now, let's check the raw DB query

from app.db.models.labeler import AnnotationVersion
from app.core.database import get_labeler_db

labeler_db = next(get_labeler_db())

try:
    versions = labeler_db.query(AnnotationVersion).filter(
        AnnotationVersion.project_id == 'proj_086e61ad81d2',
        AnnotationVersion.version_type == "published"
    ).all()

    print("Direct DB query results:")
    for v in versions:
        print(f"  {v.version_number}:")
        print(f"    id: {v.id}")
        print(f"    task_type: {v.task_type}")
        print(f"    type: {type(v.task_type)}")

finally:
    labeler_db.close()
