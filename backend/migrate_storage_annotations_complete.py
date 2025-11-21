"""Complete S3 storage migration: Find all annotations.json files and migrate to task-specific names."""

import boto3
from botocore.client import Config
from sqlalchemy import create_engine, text
from app.core.config import settings

# Create database engine
platform_engine = create_engine(settings.PLATFORM_DB_URL)

# Create S3 client
s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT,
    aws_access_key_id=settings.S3_ACCESS_KEY,
    aws_secret_access_key=settings.S3_SECRET_KEY,
    region_name=settings.S3_REGION,
    config=Config(signature_version='s3v4')
)

print("=== Complete S3 Storage Migration ===")
print("Scanning S3 for all annotations.json files...\n")

# Step 1: Scan S3 for all annotations.json files
print("Step 1: Scanning S3 bucket...")
try:
    # List all objects with prefix "datasets/"
    paginator = s3_client.get_paginator('list_objects_v2')
    pages = paginator.paginate(
        Bucket=settings.S3_BUCKET_DATASETS,
        Prefix='datasets/'
    )

    annotation_files = []
    for page in pages:
        if 'Contents' not in page:
            continue

        for obj in page['Contents']:
            key = obj['Key']
            # Find files that match pattern: datasets/{id}/annotations.json
            if key.endswith('/annotations.json'):
                # Extract dataset_id from path
                parts = key.split('/')
                if len(parts) >= 3 and parts[0] == 'datasets':
                    dataset_id = parts[1]
                    annotation_files.append({
                        'dataset_id': dataset_id,
                        'old_key': key,
                        'size': obj['Size']
                    })

    print(f"Found {len(annotation_files)} annotations.json files in S3\n")

except Exception as e:
    print(f"Error scanning S3: {e}")
    exit(1)

if not annotation_files:
    print("[INFO] No annotations.json files found. Migration already complete.")
    exit(0)

# Step 2: Migrate each file
migrated_count = 0
error_count = 0

with platform_engine.connect() as conn:
    for file_info in annotation_files:
        dataset_id = file_info['dataset_id']
        old_key = file_info['old_key']

        print(f"Dataset ID: {dataset_id}")
        print(f"  Current file: {old_key} ({file_info['size']:,} bytes)")

        # Check if dataset exists in Platform DB
        result = conn.execute(text("""
            SELECT id, name, labeled, annotation_path
            FROM datasets
            WHERE id = :dataset_id
        """), {"dataset_id": dataset_id})

        dataset_row = result.fetchone()
        if dataset_row:
            dataset_name = dataset_row[1]
            print(f"  Dataset name: {dataset_name}")
        else:
            print(f"  [WARNING] Dataset not found in Platform DB")

        # Determine task type (default to detection for existing datasets)
        task_type = 'detection'
        new_key = old_key.replace('/annotations.json', f'/annotations_{task_type}.json')

        print(f"  New file: {new_key}")

        try:
            # Copy file to new location
            copy_source = {
                'Bucket': settings.S3_BUCKET_DATASETS,
                'Key': old_key
            }
            s3_client.copy_object(
                CopySource=copy_source,
                Bucket=settings.S3_BUCKET_DATASETS,
                Key=new_key
            )
            print(f"  [OK] Copied to new location")

            # Update Platform DB if dataset exists
            if dataset_row:
                conn.execute(text("""
                    UPDATE datasets
                    SET annotation_path = :new_path,
                        labeled = TRUE
                    WHERE id = :dataset_id
                """), {"new_path": new_key, "dataset_id": dataset_id})
                conn.commit()
                print(f"  [OK] Updated Platform DB (annotation_path, labeled=TRUE)")

            # Delete old file
            s3_client.delete_object(
                Bucket=settings.S3_BUCKET_DATASETS,
                Key=old_key
            )
            print(f"  [OK] Deleted old file")

            migrated_count += 1

        except Exception as e:
            print(f"  [ERROR] Migration failed: {e}")
            error_count += 1
            conn.rollback()

        print()

print("\n=== Migration Summary ===")
print(f"Total files found: {len(annotation_files)}")
print(f"Migrated successfully: {migrated_count}")
print(f"Errors: {error_count}")

if migrated_count > 0:
    print("\n[OK] Complete storage migration finished!")
    print("All annotations.json files have been renamed to annotations_detection.json")

    # Verify
    print("\n=== Verification ===")
    with platform_engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id, name, annotation_path, labeled
            FROM datasets
            WHERE annotation_path IS NOT NULL
            ORDER BY created_at DESC
        """))

        print("Datasets with annotation files:")
        for row in result:
            print(f"  {row[1]}: {row[2]} (labeled={row[3]})")
