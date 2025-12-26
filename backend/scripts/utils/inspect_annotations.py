"""Quick script to inspect annotations.json structure."""
import boto3
import json
from app.core.config import settings

s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT,
    aws_access_key_id=settings.S3_ACCESS_KEY,
    aws_secret_access_key=settings.S3_SECRET_KEY,
    region_name=settings.S3_REGION
)

# Download annotations.json
annotation_path = "datasets/468cc408-d9cf-47bc-9a0a-d9aaf63b4f35/annotations.json"
response = s3_client.get_object(
    Bucket=settings.S3_BUCKET_DATASETS,
    Key=annotation_path
)
content = response['Body'].read().decode('utf-8')
data = json.loads(content)

# Print structure
print("=== ANNOTATIONS.JSON STRUCTURE ===\n")
print(f"Keys: {list(data.keys())}\n")

# Check categories
print("=== CATEGORIES (first 3) ===")
if 'categories' in data:
    for i, cat in enumerate(data['categories'][:3]):
        print(f"\nCategory {i+1}:")
        print(json.dumps(cat, indent=2))

print(f"\n\nTotal categories: {len(data.get('categories', []))}")

# Check annotations structure
print("\n\n=== ANNOTATIONS (first 2) ===")
if 'annotations' in data:
    for i, ann in enumerate(data['annotations'][:2]):
        print(f"\nAnnotation {i+1}:")
        print(json.dumps(ann, indent=2))

print(f"\n\nTotal annotations: {len(data.get('annotations', []))}")

# Calculate per-class statistics
print("\n\n=== PER-CLASS STATISTICS ===")
from collections import defaultdict

class_stats = defaultdict(lambda: {'image_ids': set(), 'bbox_count': 0})

for ann in data.get('annotations', []):
    cat_id = ann.get('category_id')
    img_id = ann.get('image_id')

    class_stats[cat_id]['image_ids'].add(img_id)
    class_stats[cat_id]['bbox_count'] += 1

# Create category lookup
cat_lookup = {cat['id']: cat['name'] for cat in data.get('categories', [])}

print(f"\n{'Category ID':<12} {'Class Name':<30} {'Images':<10} {'Bboxes':<10}")
print("-" * 70)
for cat_id in sorted(class_stats.keys()):
    stats = class_stats[cat_id]
    cat_name = cat_lookup.get(cat_id, f"Unknown-{cat_id}")
    print(f"{cat_id:<12} {cat_name:<30} {len(stats['image_ids']):<10} {stats['bbox_count']:<10}")
