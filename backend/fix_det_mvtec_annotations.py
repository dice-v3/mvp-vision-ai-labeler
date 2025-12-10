"""Fix det-mvtec annotations.json by rebuilding from S3 images."""

import boto3
import json
from botocore.client import Config
from app.core.config import settings
from PIL import Image
import io

# Create S3 client
s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT,
    aws_access_key_id=settings.S3_ACCESS_KEY,
    aws_secret_access_key=settings.S3_SECRET_KEY,
    region_name=settings.S3_REGION,
    config=Config(signature_version='s3v4')
)

dataset_id = 'c577e6ad-2b96-47c1-a7bd-ae91a7d46712'
prefix = f'datasets/{dataset_id}/images/'

print("=== Rebuilding det-mvtec annotations.json ===\n")

# Step 1: List all images in S3
print("Step 1: Listing images from S3...")
try:
    paginator = s3_client.get_paginator('list_objects_v2')
    pages = paginator.paginate(
        Bucket=settings.S3_BUCKET_DATASETS,
        Prefix=prefix
    )

    image_files = []
    for page in pages:
        if 'Contents' not in page:
            continue

        for obj in page['Contents']:
            key = obj['Key']
            # Skip directory markers
            if key.endswith('/'):
                continue

            # Extract relative path from images/
            if '/images/' in key:
                relative_path = key.split('/images/', 1)[1]
                image_files.append({
                    'key': key,
                    'relative_path': relative_path
                })

    print(f"Found {len(image_files)} images\n")

except Exception as e:
    print(f"Error: {e}")
    exit(1)

# Step 2: Build DICE format annotations
print("Step 2: Building DICE format annotations...")

images = []
for idx, img_info in enumerate(image_files, start=1):
    try:
        # Get image dimensions
        response = s3_client.get_object(
            Bucket=settings.S3_BUCKET_DATASETS,
            Key=img_info['key']
        )
        img_data = response['Body'].read()
        img = Image.open(io.BytesIO(img_data))
        width, height = img.size

        images.append({
            'id': idx,
            'file_name': img_info['relative_path'],
            'width': width,
            'height': height
        })

        if idx % 10 == 0:
            print(f"  Processed {idx}/{len(image_files)} images...")

    except Exception as e:
        print(f"  [WARNING] Failed to process {img_info['relative_path']}: {e}")
        # Add without dimensions
        images.append({
            'id': idx,
            'file_name': img_info['relative_path'],
            'width': None,
            'height': None
        })

print(f"  Total images processed: {len(images)}\n")

# Build DICE format
dice_data = {
    'images': images,
    'annotations': [],  # No annotations yet
    'categories': []  # No categories yet
}

# Step 3: Upload to S3
print("Step 3: Uploading to S3...")
annotation_key = f'datasets/{dataset_id}/annotations_detection.json'

try:
    s3_client.put_object(
        Bucket=settings.S3_BUCKET_DATASETS,
        Key=annotation_key,
        Body=json.dumps(dice_data, indent=2).encode('utf-8'),
        ContentType='application/json'
    )
    print(f"  [OK] Uploaded to {annotation_key}\n")

except Exception as e:
    print(f"  [ERROR] Upload failed: {e}")
    exit(1)

# Step 4: Verify
print("Step 4: Verification...")
try:
    response = s3_client.get_object(
        Bucket=settings.S3_BUCKET_DATASETS,
        Key=annotation_key
    )
    content = response['Body'].read().decode('utf-8')
    data = json.loads(content)

    print(f"  Images: {len(data.get('images', []))}")
    print(f"  Annotations: {len(data.get('annotations', []))}")
    print(f"  Categories: {len(data.get('categories', []))}")

    print("\n  First 3 images:")
    for img in data.get('images', [])[:3]:
        print(f"    ID: {img['id']}, file_name: {img['file_name']}, size: {img.get('width')}x{img.get('height')}")

    print("\n[OK] Annotations file fixed successfully!")

except Exception as e:
    print(f"  [ERROR] Verification failed: {e}")
