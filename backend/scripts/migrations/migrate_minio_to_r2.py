"""
MinIO to Cloudflare R2 Migration Script

Migrates all objects from MinIO training-datasets bucket to Cloudflare R2.
Preserves directory structure and metadata.
"""

import boto3
from botocore.client import Config
import sys
from datetime import datetime

# MinIO Configuration
MINIO_ENDPOINT = "http://localhost:9000"
MINIO_ACCESS_KEY = "minioadmin"
MINIO_SECRET_KEY = "minioadmin"
MINIO_BUCKET = "training-datasets"

# Cloudflare R2 Configuration
R2_ACCOUNT_ID = "4b324fd59e236f471c6ff612658615a0"
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_ACCESS_KEY = "a065ad8808cb1081d8a98ecc03906025"
R2_SECRET_KEY = "6eedebd8c6cfae1bc5db45a7bab3f78ad3cf1fa0730e57130e621e1b0f8d20e8"
R2_BUCKET = "training-datasets"


def create_s3_client(endpoint, access_key, secret_key, use_ssl=True):
    """Create S3 client for MinIO or R2."""
    return boto3.client(
        's3',
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version='s3v4'),
        region_name='auto'  # R2 uses 'auto', MinIO doesn't care
    )


def list_all_objects(s3_client, bucket):
    """List all objects in a bucket (handles pagination)."""
    objects = []
    paginator = s3_client.get_paginator('list_objects_v2')

    for page in paginator.paginate(Bucket=bucket):
        if 'Contents' in page:
            objects.extend(page['Contents'])

    return objects


def copy_object(source_client, dest_client, source_bucket, dest_bucket, key):
    """Copy single object from source to destination."""
    try:
        # Download from MinIO
        response = source_client.get_object(Bucket=source_bucket, Key=key)
        body = response['Body'].read()

        # Get metadata
        metadata = response.get('Metadata', {})
        content_type = response.get('ContentType', 'application/octet-stream')

        # Upload to R2
        dest_client.put_object(
            Bucket=dest_bucket,
            Key=key,
            Body=body,
            ContentType=content_type,
            Metadata=metadata
        )

        return True, len(body)
    except Exception as e:
        return False, str(e)


def format_bytes(bytes_count):
    """Format bytes to human-readable size."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_count < 1024.0:
            return f"{bytes_count:.2f} {unit}"
        bytes_count /= 1024.0
    return f"{bytes_count:.2f} TB"


def main():
    print("=" * 60)
    print("MinIO → Cloudflare R2 Migration")
    print("=" * 60)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # Create S3 clients
    print("Connecting to MinIO...")
    minio_client = create_s3_client(MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, use_ssl=False)

    print("Connecting to Cloudflare R2...")
    r2_client = create_s3_client(R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY, use_ssl=True)

    # Test connections
    try:
        print(f"\nTesting MinIO connection ({MINIO_BUCKET})...")
        minio_client.head_bucket(Bucket=MINIO_BUCKET)
        print("[OK] MinIO connection successful")
    except Exception as e:
        print(f"[FAIL] MinIO connection failed: {e}")
        sys.exit(1)

    try:
        print(f"\nTesting R2 connection ({R2_BUCKET})...")
        r2_client.head_bucket(Bucket=R2_BUCKET)
        print("[OK] R2 connection successful")
    except Exception as e:
        print(f"[FAIL] R2 connection failed: {e}")
        print("\nMake sure the R2 bucket exists and credentials are correct.")
        sys.exit(1)

    # List all objects in MinIO
    print(f"\nListing objects in MinIO ({MINIO_BUCKET})...")
    objects = list_all_objects(minio_client, MINIO_BUCKET)
    total_objects = len(objects)

    if total_objects == 0:
        print("No objects found in MinIO bucket!")
        sys.exit(0)

    total_size = sum(obj['Size'] for obj in objects)
    print(f"Found {total_objects} objects ({format_bytes(total_size)})")
    print()

    # Show migration plan
    print("=" * 60)
    print("MIGRATION PLAN:")
    print(f"  Source: MinIO ({MINIO_ENDPOINT}/{MINIO_BUCKET})")
    print(f"  Destination: R2 ({R2_BUCKET})")
    print(f"  Objects: {total_objects}")
    print(f"  Total Size: {format_bytes(total_size)}")
    print("=" * 60)

    # Check for --auto flag
    import sys
    if '--auto' in sys.argv:
        print("\n[AUTO MODE] Proceeding automatically...")
    else:
        response = input("\nProceed with migration? (yes/no): ")
        if response.lower() != 'yes':
            print("Migration cancelled.")
            sys.exit(0)

    print()
    print("Starting migration...")
    print("-" * 60)

    # Migrate objects
    success_count = 0
    fail_count = 0
    total_bytes = 0

    for idx, obj in enumerate(objects, 1):
        key = obj['Key']
        size = obj['Size']

        # Progress indicator
        progress = (idx / total_objects) * 100
        print(f"[{idx}/{total_objects}] ({progress:.1f}%) {key} ({format_bytes(size)})...", end=' ')

        # Copy object
        success, result = copy_object(minio_client, r2_client, MINIO_BUCKET, R2_BUCKET, key)

        if success:
            print("[OK]")
            success_count += 1
            total_bytes += result
        else:
            print(f"[FAIL] Error: {result}")
            fail_count += 1

    # Summary
    print()
    print("=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)
    print(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Successful: {success_count}/{total_objects}")
    print(f"Failed: {fail_count}/{total_objects}")
    print(f"Total data migrated: {format_bytes(total_bytes)}")
    print("=" * 60)

    if fail_count > 0:
        print("\n[WARNING] Some objects failed to migrate. Review errors above.")
        sys.exit(1)
    else:
        print("\n[SUCCESS] All objects migrated successfully!")
        sys.exit(0)


if __name__ == "__main__":
    main()
