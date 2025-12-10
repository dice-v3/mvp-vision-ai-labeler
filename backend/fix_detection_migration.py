"""Fix migration: Set all existing projects to detection task type"""

from sqlalchemy import create_engine, text
from app.core.config import settings

# Create engine
labeler_engine = create_engine(settings.LABELER_DB_URL)

print("Fixing existing projects to detection task type...")

with labeler_engine.connect() as conn:
    # 1. Check current state
    result = conn.execute(text(
        "SELECT id, name, task_types FROM annotation_projects"
    ))
    projects = result.fetchall()

    print(f"\nFound {len(projects)} projects:")
    for proj in projects:
        print(f"  - {proj[1]}: {proj[2]}")

    # 2. Update all projects to detection
    print("\nUpdating projects to detection...")
    conn.execute(text(
        """
        UPDATE annotation_projects
        SET task_types = ARRAY['detection']
        WHERE task_types IS NULL OR task_types = ARRAY[]::varchar[] OR task_types[1] != 'detection'
        """
    ))

    # 3. Migrate classes to task_classes under detection
    print("Migrating classes to task_classes under detection...")
    conn.execute(text(
        """
        UPDATE annotation_projects
        SET task_classes = jsonb_build_object('detection', classes)
        WHERE classes IS NOT NULL AND classes != '{}'::jsonb
        """
    ))

    # 4. Update annotation_versions to detection
    print("Updating annotation versions to detection...")
    conn.execute(text(
        """
        UPDATE annotation_versions
        SET task_type = 'detection'
        WHERE task_type IS NULL OR task_type != 'detection'
        """
    ))

    conn.commit()

    # 5. Verify
    print("\n[OK] Verification:")
    result = conn.execute(text(
        "SELECT id, name, task_types, task_classes FROM annotation_projects LIMIT 3"
    ))
    for row in result:
        print(f"  Project: {row[1]}")
        print(f"    task_types: {row[2]}")
        print(f"    task_classes keys: {list(row[3].keys()) if row[3] else 'empty'}")

    version_count = conn.execute(text(
        "SELECT COUNT(*) FROM annotation_versions WHERE task_type = 'detection'"
    )).scalar()
    print(f"\n  Versions with task_type='detection': {version_count}")

print("\n[OK] Migration complete!")
