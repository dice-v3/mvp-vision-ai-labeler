"""
Cleanup old annotations before yesterday (2025-11-19)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from app.core.config import settings

def main():
    # Connect to labeler DB
    engine = create_engine(settings.LABELER_DB_URL)

    # Yesterday's date (start of day)
    yesterday = datetime(2025, 11, 19, 0, 0, 0)

    with engine.connect() as conn:
        # First, check what will be deleted
        result = conn.execute(text("""
            SELECT COUNT(*) as count,
                   MIN(created_at) as oldest,
                   MAX(created_at) as newest
            FROM annotations
            WHERE created_at < :cutoff
        """), {"cutoff": yesterday})

        row = result.fetchone()
        print(f"Annotations to delete: {row[0]}")
        print(f"Date range: {row[1]} ~ {row[2]}")

        if row[0] == 0:
            print("No annotations to delete.")
            return

        # Show sample of what will be deleted
        result = conn.execute(text("""
            SELECT id, project_id, image_id, annotation_type, created_at
            FROM annotations
            WHERE created_at < :cutoff
            ORDER BY created_at DESC
            LIMIT 10
        """), {"cutoff": yesterday})

        print("\nSample annotations to delete:")
        for r in result:
            ann_id = str(r[0])[:8] if r[0] else "N/A"
            proj_id = str(r[1])[:15] if r[1] else "N/A"
            img_id = str(r[2])[:30] if r[2] else "N/A"
            print(f"  {ann_id}... | {proj_id}... | {img_id} | {r[3]} | {r[4]}")

        # Proceed with deletion
        print("\nProceeding with deletion...")

        # Delete annotations
        result = conn.execute(text("""
            DELETE FROM annotations WHERE created_at < :cutoff
        """), {"cutoff": yesterday})
        print(f"Deleted {result.rowcount} annotations")

        conn.commit()
        print("Cleanup complete!")

if __name__ == "__main__":
    main()
