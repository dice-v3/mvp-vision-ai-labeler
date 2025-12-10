"""Fix classification task status - reset to not-started since no work was done.

The migration copied detection status to all tasks, but classification was never worked on.
This script resets classification image statuses to not-started.
"""

from app.db.models.labeler import ImageAnnotationStatus, Annotation
from app.core.database import get_labeler_db

labeler_db = next(get_labeler_db())

try:
    project_id = 'proj_086e61ad81d2'

    # Check current status distribution
    print("Current image status by task_type:")
    statuses = labeler_db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id == project_id
    ).all()

    by_task = {}
    for s in statuses:
        task = s.task_type or 'NULL'
        if task not in by_task:
            by_task[task] = {'total': 0, 'completed': 0, 'in-progress': 0, 'not-started': 0}
        by_task[task]['total'] += 1
        by_task[task][s.status] = by_task[task].get(s.status, 0) + 1

    for task, counts in by_task.items():
        print(f"  {task}: {counts}")

    # Check how many classification annotations exist
    classification_annotations = labeler_db.query(Annotation).filter(
        Annotation.project_id == project_id,
        Annotation.annotation_type == 'classification'
    ).count()

    print(f"\nClassification annotations in database: {classification_annotations}")

    # Reset classification status to not-started (since no work was done)
    print("\nResetting classification task statuses to not-started...")

    updated = labeler_db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id == project_id,
        ImageAnnotationStatus.task_type == 'classification'
    ).update({
        'status': 'not-started',
        'is_image_confirmed': False,
        'confirmed_at': None,
        'total_annotations': 0,
        'confirmed_annotations': 0,
        'draft_annotations': 0,
    })

    labeler_db.commit()

    print(f"Updated {updated} classification status records")

    # Verify
    print("\nAfter fix - image status by task_type:")
    statuses = labeler_db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id == project_id
    ).all()

    by_task = {}
    for s in statuses:
        task = s.task_type or 'NULL'
        if task not in by_task:
            by_task[task] = {'total': 0, 'completed': 0, 'in-progress': 0, 'not-started': 0}
        by_task[task]['total'] += 1
        by_task[task][s.status] = by_task[task].get(s.status, 0) + 1

    for task, counts in by_task.items():
        print(f"  {task}: {counts}")

finally:
    labeler_db.close()
