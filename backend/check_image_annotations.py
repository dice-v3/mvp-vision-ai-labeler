"""
Check annotations for specific images
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import get_labeler_db
from app.db.models.labeler import Annotation

db = next(get_labeler_db())

try:
    project_id = 'proj_086e61ad81d2'

    # Check images 000-005
    image_ids = [
        'bottle/broken_large/000.png',
        'bottle/broken_large/001.png',
        'bottle/broken_large/002.png',
        'bottle/broken_large/003.png',
        'bottle/broken_large/004.png',
        'bottle/broken_large/005.png',
    ]

    print("=" * 80)
    print("Checking Annotations for Images 000-005")
    print("=" * 80)

    for image_id in image_ids:
        print(f"\n{'=' * 80}")
        print(f"Image: {image_id}")
        print("=" * 80)

        annotations = db.query(Annotation).filter(
            Annotation.project_id == project_id,
            Annotation.image_id == image_id
        ).order_by(Annotation.annotation_type, Annotation.class_name).all()

        if not annotations:
            print("  NO ANNOTATIONS FOUND")
            continue

        print(f"  Total: {len(annotations)} annotations")
        print()

        # Group by type
        from collections import defaultdict
        by_type = defaultdict(list)
        for ann in annotations:
            by_type[ann.annotation_type].append(ann)

        for ann_type in sorted(by_type.keys()):
            anns = by_type[ann_type]
            print(f"  {ann_type.upper()}: {len(anns)} annotations")
            for ann in anns:
                geom_info = ""
                if ann.geometry:
                    geom_type = ann.geometry.get('type', 'unknown')
                    if geom_type == 'bbox':
                        geom_info = f"bbox"
                    elif geom_type == 'polygon':
                        points = ann.geometry.get('points', [])
                        geom_info = f"polygon ({len(points)} pts)"
                    elif geom_type == 'polyline':
                        points = ann.geometry.get('points', [])
                        geom_info = f"polyline ({len(points)} pts)"
                    elif geom_type == 'circle':
                        geom_info = f"circle (r={ann.geometry.get('radius')})"
                    elif geom_type == 'classification':
                        geom_info = "classification"
                    else:
                        geom_info = geom_type

                print(f"    - ID:{ann.id} | Class:{ann.class_name} | State:{ann.annotation_state} | Geom:{geom_info}")

    # Also check total annotation count
    print(f"\n{'=' * 80}")
    print("Total Annotation Count by Type")
    print("=" * 80)

    from collections import Counter
    all_anns = db.query(Annotation).filter(
        Annotation.project_id == project_id
    ).all()

    by_type_total = Counter(ann.annotation_type for ann in all_anns)

    for ann_type, count in sorted(by_type_total.items()):
        print(f"  {ann_type}: {count}")

    print(f"\n  TOTAL: {len(all_anns)} annotations")

finally:
    db.close()
