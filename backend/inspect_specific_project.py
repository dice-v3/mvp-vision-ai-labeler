"""
Inspect specific project annotations
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import get_labeler_db
from app.db.models.labeler import Annotation

db = next(get_labeler_db())

try:
    project_id = 'proj_086e61ad81d2'

    # Query for specific class names
    target_classes = ['upper_edge', 'inner_circle', 'bottle_broken_large']

    for class_name in target_classes:
        print(f"\n{'=' * 80}")
        print(f"Class: {class_name}")
        print("=" * 80)

        annotations = db.query(Annotation).filter(
            Annotation.project_id == project_id,
            Annotation.class_name == class_name
        ).all()

        print(f"Found {len(annotations)} annotations")

        for ann in annotations:
            print(f"\n  Annotation ID: {ann.id}")
            print(f"  Image ID: {ann.image_id}")
            print(f"  Annotation Type: {ann.annotation_type}")
            print(f"  Class ID: {ann.class_id}")
            print(f"  Class Name: {ann.class_name}")

            if ann.geometry:
                geom_type = ann.geometry.get('type')
                print(f"  Geometry Type: {geom_type}")

                if geom_type == 'polyline':
                    points = ann.geometry.get('points', [])
                    print(f"  -> Polyline with {len(points)} points: {points[:2]}...")
                elif geom_type == 'circle':
                    center = ann.geometry.get('center')
                    radius = ann.geometry.get('radius')
                    print(f"  -> Circle at {center} with radius {radius}")
                elif geom_type == 'classification':
                    print(f"  -> Classification (image-level)")
                    print(f"  -> Full geometry: {ann.geometry}")
                else:
                    print(f"  -> Full geometry: {ann.geometry}")

            print(f"  State: {ann.annotation_state}")
            print(f"  Created: {ann.created_at}")

    # Also list all annotations for this project
    print(f"\n{'=' * 80}")
    print("All Annotations Summary")
    print("=" * 80)

    all_anns = db.query(Annotation).filter(
        Annotation.project_id == project_id
    ).all()

    from collections import defaultdict
    by_type = defaultdict(list)

    for ann in all_anns:
        by_type[ann.annotation_type].append(ann)

    for ann_type, anns in sorted(by_type.items()):
        print(f"\n{ann_type}: {len(anns)} annotations")
        for ann in anns[:5]:
            print(f"  - ID: {ann.id} | Image: {ann.image_id} | Class: {ann.class_name}")
        if len(anns) > 5:
            print(f"  ... and {len(anns) - 5} more")

finally:
    db.close()
