"""Check task separation in annotations and project data."""

from app.db.models.labeler import AnnotationProject, Annotation
from app.core.database import get_labeler_db

labeler_db = next(get_labeler_db())

try:
    # Get project
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == 'proj_086e61ad81d2'
    ).first()

    if not project:
        print("Project not found")
    else:
        print(f"Project: {project.name}")
        print(f"Task types: {project.task_types}")
        print(f"\nTask classes:")
        if project.task_classes:
            for task_type, classes in project.task_classes.items():
                print(f"  {task_type}: {len(classes)} classes")
                for class_id, class_info in list(classes.items())[:3]:
                    print(f"    - {class_id}: {class_info.get('name')}")
        else:
            print("  No task_classes")

        print(f"\nLegacy classes: {len(project.classes) if project.classes else 0} classes")

        # Check annotations
        annotations = labeler_db.query(Annotation).filter(
            Annotation.project_id == project.id
        ).all()

        print(f"\nTotal annotations: {len(annotations)}")

        # Group by annotation_type
        by_type = {}
        for ann in annotations:
            ann_type = ann.annotation_type
            if ann_type not in by_type:
                by_type[ann_type] = []
            by_type[ann_type].append(ann)

        print("\nAnnotations by type:")
        for ann_type, anns in by_type.items():
            print(f"  {ann_type}: {len(anns)}")
            # Show first annotation
            if anns:
                first = anns[0]
                print(f"    Example: image_id={first.image_id}, class_id={first.class_id}")

finally:
    labeler_db.close()
