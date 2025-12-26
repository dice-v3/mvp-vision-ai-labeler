"""
Generate Thumbnails for Existing Images

Phase 2.12: Performance Optimization

This script generates thumbnails for all existing images that don't have them yet.

Run: python -m generate_thumbnails
"""

import sys
import os
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from app.core.database import LabelerSessionLocal
from app.core.storage import storage_client
from app.db.models.labeler import Dataset, ImageMetadata
from app.services.thumbnail_service import create_thumbnail, get_thumbnail_path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def thumbnail_exists(thumbnail_key: str) -> bool:
    """Check if thumbnail already exists in S3."""
    try:
        storage_client.s3_client.head_object(
            Bucket=storage_client.datasets_bucket,
            Key=thumbnail_key
        )
        return True
    except:
        return False


def generate_thumbnails_for_dataset(db: Session, dataset: Dataset):
    """Generate thumbnails for all images in a dataset."""
    print(f"\n{'='*80}")
    print(f"Dataset: {dataset.name} ({dataset.id})")
    print(f"{'='*80}")

    # Get all images for this dataset from DB
    images = db.query(ImageMetadata).filter(
        ImageMetadata.dataset_id == dataset.id
    ).all()

    if not images:
        print(f"No images found in database for dataset {dataset.id}")
        return

    print(f"Found {len(images)} images in database")

    generated_count = 0
    skipped_count = 0
    error_count = 0

    for idx, db_img in enumerate(images, 1):
        try:
            # Check if thumbnail already exists
            thumbnail_key = get_thumbnail_path(db_img.s3_key)

            if thumbnail_exists(thumbnail_key):
                skipped_count += 1
                if idx % 100 == 0:
                    print(f"  Progress: {idx}/{len(images)} (skipped: {skipped_count}, generated: {generated_count}, errors: {error_count})")
                continue

            # Download original image
            try:
                response = storage_client.s3_client.get_object(
                    Bucket=storage_client.datasets_bucket,
                    Key=db_img.s3_key
                )
                image_bytes = response['Body'].read()
            except Exception as e:
                logger.error(f"Failed to download {db_img.s3_key}: {e}")
                error_count += 1
                continue

            # Generate thumbnail
            thumbnail_bytes = create_thumbnail(image_bytes)
            if not thumbnail_bytes:
                logger.error(f"Failed to create thumbnail for {db_img.s3_key}")
                error_count += 1
                continue

            # Upload thumbnail
            storage_client.s3_client.put_object(
                Bucket=storage_client.datasets_bucket,
                Key=thumbnail_key,
                Body=thumbnail_bytes,
                ContentType='image/jpeg'
            )

            generated_count += 1

            # Progress logging
            if generated_count % 10 == 0:
                print(f"  Generated {generated_count} thumbnails...")

        except Exception as e:
            logger.error(f"Error processing {db_img.id}: {e}")
            error_count += 1
            continue

    print(f"\nSUCCESS: Dataset {dataset.name}")
    print(f"  Generated: {generated_count}")
    print(f"  Skipped (already exists): {skipped_count}")
    print(f"  Errors: {error_count}")


def main():
    """Main thumbnail generation process."""
    print("="*80)
    print("Thumbnail Generation")
    print("Phase 2.12: Performance Optimization")
    print("="*80)

    db = LabelerSessionLocal()

    try:
        # Get all datasets
        datasets = db.query(Dataset).all()
        print(f"\nFound {len(datasets)} datasets")

        total_generated = 0
        total_skipped = 0
        total_errors = 0

        for dataset in datasets:
            try:
                result = generate_thumbnails_for_dataset(db, dataset)
            except Exception as e:
                print(f"ERROR processing {dataset.name}: {e}")
                import traceback
                traceback.print_exc()
                continue

        print("\n" + "="*80)
        print("SUCCESS: Thumbnail generation complete!")
        print("="*80)

    except Exception as e:
        print(f"\nFATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
