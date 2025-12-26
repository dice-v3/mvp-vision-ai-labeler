"""
Backfill Image Metadata

Phase 2.12: Populate image_metadata table from existing S3 images.

This script:
1. Scans all datasets in DB
2. Lists images from S3
3. Saves metadata to image_metadata table

Run: python -m backfill_image_metadata
"""

import sys
import os
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from app.core.database import LabelerSessionLocal  # Labeler DB session factory
from app.core.storage import storage_client
from app.db.models.labeler import Dataset, ImageMetadata

def is_image_file(filename: str) -> bool:
    """Check if file is an image."""
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'}
    return any(filename.lower().endswith(ext) for ext in image_extensions)

def backfill_dataset_images(db: Session, dataset: Dataset):
    """Backfill images for a single dataset."""
    print(f"\n{'='*80}")
    print(f"Dataset: {dataset.name} ({dataset.id})")
    print(f"{'='*80}")

    # Check existing count for info
    existing_count = db.query(ImageMetadata).filter(
        ImageMetadata.dataset_id == dataset.id
    ).count()

    if existing_count > 0:
        print(f"Note: Already has {existing_count} images in DB. Will check each image individually...")

    # List all images from S3
    s3_prefix = f"datasets/{dataset.id}/images/"
    print(f"Scanning S3: {s3_prefix}")

    all_objects = []
    continuation_token = None

    while True:
        list_params = {
            'Bucket': storage_client.datasets_bucket,
            'Prefix': s3_prefix,
            'MaxKeys': 1000
        }
        if continuation_token:
            list_params['ContinuationToken'] = continuation_token

        response = storage_client.s3_client.list_objects_v2(**list_params)

        if 'Contents' in response:
            all_objects.extend(response['Contents'])

        if not response.get('IsTruncated'):
            break

        continuation_token = response.get('NextContinuationToken')

    # Filter image files
    image_objects = []
    for obj in all_objects:
        key = obj['Key']

        # Skip folders
        if key.endswith('/'):
            continue

        # Extract filename
        filename = key.split('/')[-1]

        # Skip non-image files
        if not is_image_file(filename):
            continue

        image_objects.append(obj)

    print(f"Found {len(image_objects)} images in S3")

    # Save to DB
    saved_count = 0
    for obj in image_objects:
        key = obj['Key']
        filename = key.split('/')[-1]

        # Extract relative path (everything after /images/)
        # e.g., "datasets/ds_xxx/images/train/good/001.jpg" -> "train/good/001.jpg"
        relative_path = key.replace(s3_prefix, '')

        # Extract folder path (everything except filename)
        path_parts = relative_path.split('/')
        if len(path_parts) > 1:
            folder_path = '/'.join(path_parts[:-1])
        else:
            folder_path = None

        # Generate unique image ID (relative path with extension for S3 key compatibility)
        # e.g., "train/good/001.jpg" -> "train/good/001.jpg"
        image_id = relative_path

        # Check if already exists
        existing = db.query(ImageMetadata).filter(
            ImageMetadata.id == image_id,
            ImageMetadata.dataset_id == dataset.id
        ).first()

        if existing:
            print(f"  SKIP (exists): {filename}")
            continue

        # Create metadata record
        db_image = ImageMetadata(
            id=image_id,
            dataset_id=dataset.id,
            file_name=filename,
            s3_key=key,
            folder_path=folder_path,
            size=obj['Size'],
            uploaded_at=obj['LastModified'],
            last_modified=obj['LastModified']
        )
        db.add(db_image)
        saved_count += 1

        if saved_count % 100 == 0:
            db.commit()
            print(f"  Saved {saved_count} images...")

    # Final commit
    db.commit()
    print(f"SUCCESS: Backfilled {saved_count} images for dataset: {dataset.name}")

def main():
    """Main backfill process."""
    print("="*80)
    print("Image Metadata Backfill")
    print("Phase 2.12: Performance Optimization")
    print("="*80)

    db = LabelerSessionLocal()

    try:
        # Get all datasets
        datasets = db.query(Dataset).all()
        print(f"\nFound {len(datasets)} datasets")

        for dataset in datasets:
            try:
                backfill_dataset_images(db, dataset)
            except Exception as e:
                print(f"ERROR processing {dataset.name}: {e}")
                import traceback
                traceback.print_exc()
                continue

        print("\n" + "="*80)
        print("SUCCESS: Backfill complete!")
        print("="*80)

    except Exception as e:
        print(f"\nFATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
