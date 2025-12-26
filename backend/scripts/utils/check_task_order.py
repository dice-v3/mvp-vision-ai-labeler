"""Check task_types order in project."""

from app.db.models.labeler import AnnotationProject
from app.core.database import get_labeler_db

labeler_db = next(get_labeler_db())

try:
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == 'proj_086e61ad81d2'
    ).first()

    if project:
        print(f"Project: {project.name}")
        print(f"task_types: {project.task_types}")
        print(f"task_types[0]: {project.task_types[0] if project.task_types else 'None'}")

finally:
    labeler_db.close()
