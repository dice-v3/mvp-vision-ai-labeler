"""Migrate export files to Phase 2.9 task-based structure."""

import boto3
from botocore.client import Config
from sqlalchemy import create_engine, text
from app.core.config import settings

# Create database engines
labeler_engine = create_engine(settings.LABELER_DB_URL)

# Create S3 client
s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT,
    aws_access_key_id=settings.S3_ACCESS_KEY,
    aws_secret_access_key=settings.S3_SECRET_KEY,
    region_name=settings.S3_REGION,
    config=Config(signature_version='s3v4')
)

print("=== Export Files Migration: Phase 2.9 Task-Based Structure ===\n")

with labeler_engine.connect() as conn:
    # Get all published versions with old export_path format
    result = conn.execute(text("""
        SELECT id, project_id, task_type, version_number, export_path, export_format
        FROM annotation_versions
        WHERE version_type = 'published'
          AND export_path IS NOT NULL
          AND export_path NOT LIKE '%/detection/%'
          AND export_path NOT LIKE '%/classification/%'
          AND export_path NOT LIKE '%/segmentation/%'
        ORDER BY created_at
    """))

    versions = result.fetchall()

    print(f"Found {len(versions)} versions to migrate\n")

    if not versions:
        print("[INFO] No export files need migration")
        exit(0)

    migrated_count = 0
    error_count = 0

    for ver in versions:
        version_id, project_id, task_type, version_number, old_export_path, export_format = ver

        print(f"Version: {version_number} (Project: {project_id}, Task: {task_type})")
        print(f"  Old path: {old_export_path}")

        # Construct new path with task_type
        # Old: exports/{project_id}/v1.0/annotations.json
        # New: exports/{project_id}/detection/v1.0/annotations.json

        filename = old_export_path.split('/')[-1]  # Get filename
        new_export_path = f"exports/{project_id}/{task_type}/{version_number}/{filename}"

        print(f"  New path: {new_export_path}")

        try:
            # Check if old file exists
            try:
                s3_client.head_object(
                    Bucket=settings.S3_BUCKET_ANNOTATIONS,
                    Key=old_export_path
                )
            except Exception as e:
                print(f"  [WARNING] Old file not found in S3: {old_export_path}")
                error_count += 1
                print()
                continue

            # Copy to new location
            copy_source = {
                'Bucket': settings.S3_BUCKET_ANNOTATIONS,
                'Key': old_export_path
            }
            s3_client.copy_object(
                CopySource=copy_source,
                Bucket=settings.S3_BUCKET_ANNOTATIONS,
                Key=new_export_path
            )
            print(f"  [OK] Copied to new location")

            # Update database
            conn.execute(text("""
                UPDATE annotation_versions
                SET export_path = :new_path
                WHERE id = :version_id
            """), {"new_path": new_export_path, "version_id": version_id})
            conn.commit()
            print(f"  [OK] Updated database")

            # Delete old file
            s3_client.delete_object(
                Bucket=settings.S3_BUCKET_ANNOTATIONS,
                Key=old_export_path
            )
            print(f"  [OK] Deleted old file")

            migrated_count += 1

        except Exception as e:
            print(f"  [ERROR] Migration failed: {e}")
            error_count += 1
            conn.rollback()

        print()

print("\n=== Migration Summary ===")
print(f"Total versions: {len(versions)}")
print(f"Migrated: {migrated_count}")
print(f"Errors: {error_count}")

if migrated_count > 0:
    print("\n[OK] Export files migration complete!")

    # Verify
    print("\n=== Verification ===")
    with labeler_engine.connect() as conn:
        result = conn.execute(text("""
            SELECT project_id, task_type, version_number, export_path
            FROM annotation_versions
            WHERE version_type = 'published'
            ORDER BY created_at DESC
            LIMIT 10
        """))

        print("Recent published versions:")
        for row in result:
            print(f"  {row[0]} - {row[2]} (task: {row[1]})")
            print(f"    Path: {row[3]}")
