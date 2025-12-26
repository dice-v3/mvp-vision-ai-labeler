"""
Inspect annotations by class name to debug classification task display issue
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.core.database import get_labeler_db
from app.db.models.labeler import Annotation, AnnotationProject
from sqlalchemy import or_

db = next(get_labeler_db())

try:
    # First, let's find the project
    projects = db.query(AnnotationProject).all()
    print("=" * 80)
    print("Available Projects:")
    print("=" * 80)
    for proj in projects:
        print(f"ID: {proj.id}")
        print(f"Name: {proj.name}")
        print(f"Task Types: {proj.task_types}")
        print(f"Classes: {proj.classes}")
        print(f"Task Classes: {proj.task_classes}")
        print("-" * 80)

    if not projects:
        print("No projects found")
        sys.exit(0)

    # Use the first project (or you can specify)
    project_id = projects[0].id
    print(f"\nInspecting project: {project_id}")
    print("=" * 80)

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

        if annotations:
            for ann in annotations[:5]:  # Show first 5
                print(f"\n  Annotation ID: {ann.id}")
                print(f"  Image ID: {ann.image_id}")
                print(f"  Annotation Type: {ann.annotation_type}")
                print(f"  Class ID: {ann.class_id}")
                print(f"  Class Name: {ann.class_name}")
                print(f"  Geometry Type: {ann.geometry.get('type') if ann.geometry else 'None'}")
                print(f"  Geometry Keys: {list(ann.geometry.keys()) if ann.geometry else 'None'}")
                print(f"  Annotation State: {ann.annotation_state}")
                print(f"  Created At: {ann.created_at}")

                # Show geometry details based on type
                if ann.geometry:
                    geom_type = ann.geometry.get('type')
                    if geom_type == 'classification':
                        print(f"  -> Classification geometry (image dimensions only)")
                    elif geom_type == 'polyline':
                        points = ann.geometry.get('points', [])
                        print(f"  -> Polyline with {len(points)} points")
                    elif geom_type == 'circle':
                        center = ann.geometry.get('center')
                        radius = ann.geometry.get('radius')
                        print(f"  -> Circle at {center} with radius {radius}")
                    elif geom_type == 'polygon':
                        points = ann.geometry.get('points', [])
                        print(f"  -> Polygon with {len(points)} points")
                    elif geom_type == 'bbox':
                        print(f"  -> BBox: {ann.geometry}")
                    else:
                        print(f"  -> Unknown geometry type: {geom_type}")

            if len(annotations) > 5:
                print(f"\n  ... and {len(annotations) - 5} more")

    # Also check for any polyline/circle annotations
    print(f"\n{'=' * 80}")
    print("All Polyline Annotations")
    print("=" * 80)

    polylines = db.query(Annotation).filter(
        Annotation.project_id == project_id,
        Annotation.annotation_type == 'polyline'
    ).all()

    print(f"Found {len(polylines)} polyline annotations")
    for ann in polylines[:10]:
        print(f"  ID: {ann.id} | Image: {ann.image_id} | Class: {ann.class_name} | State: {ann.annotation_state}")

    print(f"\n{'=' * 80}")
    print("All Circle Annotations")
    print("=" * 80)

    circles = db.query(Annotation).filter(
        Annotation.project_id == project_id,
        Annotation.annotation_type == 'circle'
    ).all()

    print(f"Found {len(circles)} circle annotations")
    for ann in circles[:10]:
        print(f"  ID: {ann.id} | Image: {ann.image_id} | Class: {ann.class_name} | State: {ann.annotation_state}")

    # Check for classification annotations
    print(f"\n{'=' * 80}")
    print("All Classification Annotations")
    print("=" * 80)

    classifications = db.query(Annotation).filter(
        Annotation.project_id == project_id,
        Annotation.annotation_type == 'classification'
    ).all()

    print(f"Found {len(classifications)} classification annotations")
    for ann in classifications[:10]:
        print(f"  ID: {ann.id} | Image: {ann.image_id} | Class: {ann.class_name} | Geometry: {ann.geometry}")

finally:
    db.close()
