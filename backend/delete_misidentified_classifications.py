"""
Delete misidentified classification annotations for geometry classes

This script deletes classification annotations that were created for geometry task classes
(upper_edge and inner_circle) due to a bug.

These annotations have:
- annotation_type = 'classification'
- But class is a geometry task class
- Geometry only contains {'type': 'classification'} with no actual shape data
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import get_labeler_db
from app.db.models.labeler import Annotation

db = next(get_labeler_db())

try:
    project_id = 'proj_086e61ad81d2'

    # Find all classification annotations for geometry classes
    # Based on the inspection, the geometry classes are upper_edge and inner_circle
    geometry_class_names = ['upper_edge', 'inner_circle']

    print("=" * 80)
    print("Delete Misidentified Classification Annotations")
    print("=" * 80)
    print()

    all_to_delete = []

    for class_name in geometry_class_names:
        # Find classification annotations for this class
        misidentified = db.query(Annotation).filter(
            Annotation.project_id == project_id,
            Annotation.class_name == class_name,
            Annotation.annotation_type == 'classification'
        ).all()

        if misidentified:
            print(f"\nClass '{class_name}': Found {len(misidentified)} misidentified annotations")
            for ann in misidentified:
                print(f"  - ID: {ann.id} | Image: {ann.image_id} | State: {ann.annotation_state}")
                all_to_delete.append(ann)

    if not all_to_delete:
        print("\nNo misidentified annotations found!")
        sys.exit(0)

    print()
    print(f"Total: {len(all_to_delete)} annotations to delete")
    print()

    response = input(f"Do you want to DELETE these {len(all_to_delete)} annotations? (yes/no): ")

    if response.lower() != 'yes':
        print("Cancelled. No changes made.")
        sys.exit(0)

    # Delete the annotations
    deleted_count = 0
    for ann in all_to_delete:
        db.delete(ann)
        deleted_count += 1
        print(f"  Deleted: {ann.id}")

    db.commit()

    print()
    print(f"✓ Successfully deleted {deleted_count} misidentified annotations")
    print()

finally:
    db.close()
