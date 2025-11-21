"""Fix file_name in annotations_detection.json by scanning S3 images."""

import boto3
import json
from botocore.client import Config
from app.core.config import settings
from PIL import Image
import io

# Initialize S3 client
s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT,
    aws_access_key_id=settings.S3_ACCESS_KEY,
    aws_secret_access_key=settings.S3_SECRET_KEY,
    region_name=settings.S3_REGION,
    config=Config(signature_version='s3v4')
)

dataset_id = "8f97389d-aa20-4de3-9872-d3cf8909a53c"
bucket = settings.S3_BUCKET_DATASETS
annotations_key = f"datasets/{dataset_id}/annotations_detection.json"
images_prefix = f"datasets/{dataset_id}/images/"

print(f"Dataset ID: {dataset_id}")
print(f"Bucket: {bucket}")
print(f"Annotations key: {annotations_key}")
print(f"Images prefix: {images_prefix}")

# Load existing annotations
print("\n1. Loading existing annotations...")
response = s3_client.get_object(Bucket=bucket, Key=annotations_key)
annotations_json = json.loads(response['Body'].read().decode('utf-8'))

print(f"   Found {len(annotations_json.get('images', []))} images in annotations")
print(f"   Found {len(annotations_json.get('annotations', []))} annotations")

# Scan S3 for actual images
print("\n2. Scanning S3 for images...")
paginator = s3_client.get_paginator('list_objects_v2')
pages = paginator.paginate(Bucket=bucket, Prefix=images_prefix)

s3_images = []
for page in pages:
    if 'Contents' in page:
        for obj in page['Contents']:
            key = obj['Key']
            if key.endswith('/'):
                continue
            if key.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp')):
                # Extract relative path from images/
                relative_path = key.split('/images/', 1)[1] if '/images/' in key else key.split('/')[-1]
                s3_images.append({
                    'key': key,
                    'relative_path': relative_path,
                    'size': obj['Size']
                })

print(f"   Found {len(s3_images)} images in S3")

# Create mapping: old numeric file_name -> actual file path
print("\n3. Creating image ID to file_name mapping...")

# Build new images array with correct file_name and dimensions
new_images = []
for idx, s3_img in enumerate(s3_images, start=1):
    try:
        # Download image to get dimensions
        img_response = s3_client.get_object(Bucket=bucket, Key=s3_img['key'])
        img_data = img_response['Body'].read()
        img = Image.open(io.BytesIO(img_data))
        width, height = img.size

        new_images.append({
            'id': idx,
            'file_name': s3_img['relative_path'],
            'width': width,
            'height': height
        })
        print(f"   {idx}: {s3_img['relative_path']} ({width}x{height})")

    except Exception as e:
        print(f"   Error processing {s3_img['key']}: {e}")
        new_images.append({
            'id': idx,
            'file_name': s3_img['relative_path'],
            'width': 0,
            'height': 0
        })

# Update annotations.json with corrected images
print(f"\n4. Updating annotations.json with {len(new_images)} corrected images...")
annotations_json['images'] = new_images

# Save back to S3
print(f"\n5. Saving corrected annotations to S3...")
s3_client.put_object(
    Bucket=bucket,
    Key=annotations_key,
    Body=json.dumps(annotations_json, indent=2),
    ContentType='application/json'
)

print(f"\n✅ Successfully updated {annotations_key}")
print(f"   Total images: {len(new_images)}")
print(f"   Total annotations: {len(annotations_json.get('annotations', []))}")
print(f"   Total categories: {len(annotations_json.get('categories', []))}")
