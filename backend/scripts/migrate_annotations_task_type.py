"""
Data Migration Script: Populate task_type in annotations table

This script migrates existing annotation data by inferring task_type from
annotation_type using the task registry.

Usage:
    python scripts/migrate_annotations_task_type.py

    # Dry run (no changes)
    python scripts/migrate_annotations_task_type.py --dry-run

    # Migrate specific project
    python scripts/migrate_annotations_task_type.py --project-id <project_id>

Requirements:
    - Database schema migration (20251120_1500_*) must be applied first
    - Task registry must be initialized

Process:
    1. Load all annotations with null task_type
    2. Infer task_type from annotation_type using task_registry
    3. Update annotations with inferred task_type
    4. Handle special cases (no_object annotations)
    5. Verify no annotations left with null task_type
"""

import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

import argparse
from sqlalchemy import func
from app.core.database import get_labeler_db
from app.db.models.labeler import Annotation
from app.tasks import task_registry, AnnotationType


def migrate_annotations(dry_run: bool = False, project_id: str = None):
    """
    Migrate annotation task_type values.

    Args:
        dry_run: If True, print changes without applying them
        project_id: If provided, only migrate annotations for this project
    """

    db = next(get_labeler_db())

    print("=" * 80)
    print("ANNOTATION TASK_TYPE MIGRATION")
    print("=" * 80)
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE MIGRATION'}")
    print(f"Project filter: {project_id if project_id else 'All projects'}")
    print()

    # Query annotations with null task_type
    query = db.query(Annotation).filter(Annotation.task_type.is_(None))

    if project_id:
        query = query.filter(Annotation.project_id == project_id)

    annotations = query.all()

    print(f"Found {len(annotations)} annotations to migrate")
    print()

    if len(annotations) == 0:
        print("[OK] No annotations to migrate!")
        return

    # Statistics
    stats = {
        'total': len(annotations),
        'by_task': {},
        'no_object': 0,
        'errors': 0,
    }

    # Process each annotation
    for i, ann in enumerate(annotations, 1):
        if i % 1000 == 0:
            print(f"Progress: {i}/{len(annotations)} ({i/len(annotations)*100:.1f}%)")

        try:
            # Infer task_type from annotation_type
            if ann.annotation_type == 'no_object':
                # Special case: get task_type from attributes
                task_type_str = ann.attributes.get('task_type') if ann.attributes else None

                if not task_type_str:
                    print(f"[WARNING]  Warning: no_object annotation {ann.id} has no task_type in attributes")
                    stats['errors'] += 1
                    continue

                stats['no_object'] += 1

            else:
                # Normal case: use task registry
                try:
                    ann_type = AnnotationType(ann.annotation_type)
                except ValueError:
                    print(f"[WARNING]  Warning: Unknown annotation_type '{ann.annotation_type}' for annotation {ann.id}")
                    stats['errors'] += 1
                    continue

                task_type_enum = task_registry.get_task_for_annotation_type(ann_type)

                if not task_type_enum:
                    print(f"[WARNING]  Warning: No task found for annotation_type '{ann.annotation_type}' (annotation {ann.id})")
                    stats['errors'] += 1
                    continue

                task_type_str = task_type_enum.value

            # Update task_type
            if not dry_run:
                ann.task_type = task_type_str

            # Update statistics
            stats['by_task'][task_type_str] = stats['by_task'].get(task_type_str, 0) + 1

            if dry_run and i <= 10:
                print(f"  [{i}] Annotation {ann.id}: {ann.annotation_type} → {task_type_str}")

        except Exception as e:
            print(f"[ERROR] Error processing annotation {ann.id}: {e}")
            stats['errors'] += 1

    # Commit changes
    if not dry_run:
        print()
        print("Committing changes to database...")
        db.commit()
        print("[OK] Migration complete!")
    else:
        print()
        print("DRY RUN - No changes committed")

    # Print statistics
    print()
    print("=" * 80)
    print("MIGRATION STATISTICS")
    print("=" * 80)
    print(f"Total annotations processed: {stats['total']}")
    print(f"Errors encountered: {stats['errors']}")
    print(f"No_object annotations: {stats['no_object']}")
    print()
    print("Annotations by task type:")
    for task_type, count in sorted(stats['by_task'].items()):
        print(f"  {task_type:20s}: {count:6d} ({count/stats['total']*100:5.1f}%)")
    print()

    # Verify completion
    remaining = db.query(func.count(Annotation.id)).filter(Annotation.task_type.is_(None)).scalar()

    if remaining > 0:
        print(f"[WARNING]  WARNING: {remaining} annotations still have null task_type!")
        print("   Review errors above and re-run migration.")
    else:
        print("[OK] VERIFICATION PASSED: All annotations have task_type values!")

    db.close()


def main():
    """Main entry point."""

    parser = argparse.ArgumentParser(
        description='Migrate annotation task_type values',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run (no changes)
  python scripts/migrate_annotations_task_type.py --dry-run

  # Migrate all annotations
  python scripts/migrate_annotations_task_type.py

  # Migrate specific project
  python scripts/migrate_annotations_task_type.py --project-id myproject123
        """
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Print what would be changed without applying changes'
    )

    parser.add_argument(
        '--project-id',
        type=str,
        help='Only migrate annotations for this project'
    )

    args = parser.parse_args()

    try:
        migrate_annotations(dry_run=args.dry_run, project_id=args.project_id)
    except Exception as e:
        print(f"\n[ERROR] Migration failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
