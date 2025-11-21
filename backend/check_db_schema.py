"""
Check database schema for CASCADE DELETE
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import get_labeler_db
from sqlalchemy import inspect, text

db = next(get_labeler_db())

try:
    # Get table schema
    inspector = inspect(db.bind)

    print("=" * 80)
    print("Annotations Table Foreign Keys")
    print("=" * 80)

    fks = inspector.get_foreign_keys('annotations')
    for fk in fks:
        print(f"\nForeign Key: {fk['name']}")
        print(f"  Columns: {fk['constrained_columns']}")
        print(f"  References: {fk['referred_table']}.{fk['referred_columns']}")
        print(f"  On Delete: {fk.get('ondelete', 'NO ACTION')}")
        print(f"  On Update: {fk.get('onupdate', 'NO ACTION')}")

    # Also check image_annotation_status table
    print("\n" + "=" * 80)
    print("Image Annotation Status Table Foreign Keys")
    print("=" * 80)

    fks = inspector.get_foreign_keys('image_annotation_status')
    for fk in fks:
        print(f"\nForeign Key: {fk['name']}")
        print(f"  Columns: {fk['constrained_columns']}")
        print(f"  References: {fk['referred_table']}.{fk['referred_columns']}")
        print(f"  On Delete: {fk.get('ondelete', 'NO ACTION')}")
        print(f"  On Update: {fk.get('onupdate', 'NO ACTION')}")

    # Check if there were any recent deletes in audit log or check timestamps
    print("\n" + "=" * 80)
    print("Recent Activity Check")
    print("=" * 80)

    # Check when was the last annotation created/deleted
    result = db.execute(text("""
        SELECT
            MAX(created_at) as last_created,
            MAX(updated_at) as last_updated
        FROM annotations
        WHERE project_id = 'proj_086e61ad81d2'
    """))

    row = result.fetchone()
    print(f"\nLast annotation created: {row[0]}")
    print(f"Last annotation updated: {row[1]}")

finally:
    db.close()
