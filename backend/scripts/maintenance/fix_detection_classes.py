"""Fix detection task_classes by copying from legacy classes."""

from sqlalchemy.orm.attributes import flag_modified
from app.db.models.labeler import AnnotationProject
from app.core.database import get_labeler_db

labeler_db = next(get_labeler_db())

try:
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == 'proj_086e61ad81d2'
    ).first()

    if not project:
        print("Project not found")
    else:
        print(f"Project: {project.name}")
        print(f"Task types: {project.task_types}")

        print(f"\nBefore fix:")
        print(f"  Legacy classes: {project.classes}")
        print(f"  Task classes: {project.task_classes}")

        # Copy legacy classes to detection task
        if project.classes and 'detection' in project.task_types:
            if not project.task_classes:
                project.task_classes = {}

            project.task_classes['detection'] = dict(project.classes)

            # Also add to classification if it exists
            if 'classification' in project.task_types:
                project.task_classes['classification'] = dict(project.classes)

            # Mark as modified for JSONB field
            flag_modified(project, 'task_classes')

            labeler_db.commit()
            labeler_db.refresh(project)

            print(f"\nAfter fix:")
            print(f"  Task classes: {project.task_classes}")
            print(f"\n✓ Successfully copied classes to task_classes")
        else:
            print("\nNo legacy classes to copy or detection task not found")

finally:
    labeler_db.close()
