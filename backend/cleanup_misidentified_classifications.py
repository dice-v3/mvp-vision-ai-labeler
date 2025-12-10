"""
Cleanup script for misidentified classification annotations

This script removes classification annotations that were incorrectly created
due to a bug where polyline/circle annotations were saved as classifications.

These misidentified annotations typically have:
- annotation_type = 'classification'
- But geometry contains shape data (points, center/radius, etc.) instead of just image dimensions

Run this script to clean up the database after fixing the bug.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session
from app.core.database import get_labeler_db
from app.db.models.labeler import Annotation


def find_misidentified_classifications(db: Session) -> list[Annotation]:
    """
    Find classification annotations that have invalid geometry.

    Valid classification geometry should only have:
    - type: 'classification'
    - image_width
    - image_height

    Invalid (misidentified) ones have additional fields like:
    - points (from polyline)
    - center, radius (from circle)
    """
    all_classifications = db.query(Annotation).filter(
        Annotation.annotation_type == 'classification'
    ).all()

    misidentified = []

    for ann in all_classifications:
        geometry = ann.geometry

        if not geometry or not isinstance(geometry, dict):
            continue

        # Check for polyline data
        if 'points' in geometry and isinstance(geometry.get('points'), list):
            print(f"  Found misidentified polyline: {ann.id} - Image: {ann.image_id}")
            misidentified.append(ann)
            continue

        # Check for circle data
        if 'center' in geometry and 'radius' in geometry:
            print(f"  Found misidentified circle: {ann.id} - Image: {ann.image_id}")
            misidentified.append(ann)
            continue

        # Check for bbox data
        if any(key in geometry for key in ['x', 'y', 'width', 'height', 'bbox']):
            print(f"  Found misidentified bbox: {ann.id} - Image: {ann.image_id}")
            misidentified.append(ann)
            continue

        # Check for polygon data
        if 'polygon' in geometry:
            print(f"  Found misidentified polygon: {ann.id} - Image: {ann.image_id}")
            misidentified.append(ann)
            continue

    return misidentified


def main():
    print("=" * 60)
    print("Cleanup Misidentified Classification Annotations")
    print("=" * 60)
    print()

    # Create database session
    db = next(get_labeler_db())

    try:
        print("Searching for misidentified classification annotations...")
        print()

        misidentified = find_misidentified_classifications(db)

        print()
        print(f"Found {len(misidentified)} misidentified annotations")
        print()

        if len(misidentified) == 0:
            print("No misidentified annotations found. Database is clean!")
            return

        # Show details
        print("Details:")
        for ann in misidentified:
            geometry_type = "unknown"
            if 'points' in ann.geometry:
                geometry_type = "polyline"
            elif 'center' in ann.geometry and 'radius' in ann.geometry:
                geometry_type = "circle"
            elif any(key in ann.geometry for key in ['x', 'y', 'bbox']):
                geometry_type = "bbox"
            elif 'polygon' in ann.geometry:
                geometry_type = "polygon"

            print(f"  ID: {ann.id} | Project: {ann.project_id} | Image: {ann.image_id} | "
                  f"Actual Type: {geometry_type} | Class: {ann.class_name}")

        print()
        response = input(f"Do you want to DELETE these {len(misidentified)} annotations? (yes/no): ")

        if response.lower() != 'yes':
            print("Cancelled. No changes made.")
            return

        # Delete the misidentified annotations
        deleted_count = 0
        for ann in misidentified:
            db.delete(ann)
            deleted_count += 1

        db.commit()

        print()
        print(f"✓ Successfully deleted {deleted_count} misidentified annotations")
        print()
        print("Cleanup complete!")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
