"""Fix classification task_classes - reset to empty since no work was done.

The fix_detection_classes.py script copied detection classes to classification,
but classification should have its own separate classes.
"""

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
        if project.task_classes:
            for task_type, classes in project.task_classes.items():
                print(f"  {task_type}: {len(classes)} classes")
        else:
            print("  No task_classes")

        # Clear classification classes (user should define their own)
        if project.task_classes and 'classification' in project.task_classes:
            project.task_classes['classification'] = {}

            # Mark as modified for JSONB field
            flag_modified(project, 'task_classes')

            labeler_db.commit()
            labeler_db.refresh(project)

            print(f"\nAfter fix:")
            for task_type, classes in project.task_classes.items():
                print(f"  {task_type}: {len(classes)} classes")
            print(f"\nSuccessfully cleared classification classes")
        else:
            print("\nNo classification task_classes to clear")

finally:
    labeler_db.close()
