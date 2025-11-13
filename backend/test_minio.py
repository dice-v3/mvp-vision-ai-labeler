"""Test MinIO connection and presigned URL generation."""
import boto3
from botocore.client import Config

# MinIO configuration
ENDPOINT = "http://localhost:9000"
ACCESS_KEY = "minioadmin"
SECRET_KEY = "minioadmin"
BUCKET = "training-datasets"
KEY = "datasets/468cc408-d9cf-47bc-9a0a-d9aaf63b4f35/000000000009.jpg"

print("Testing MinIO connection...")
print(f"Endpoint: {ENDPOINT}")
print(f"Bucket: {BUCKET}")
print(f"Key: {KEY}")
print()

# Create S3 client
s3_client = boto3.client(
    's3',
    endpoint_url=ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    region_name='us-east-1',
    config=Config(signature_version='s3v4')
)

# Test 1: List buckets
print("Test 1: List buckets")
try:
    response = s3_client.list_buckets()
    print("✓ Successfully listed buckets:")
    for bucket in response['Buckets']:
        print(f"  - {bucket['Name']}")
except Exception as e:
    print(f"✗ Failed to list buckets: {e}")
print()

# Test 2: Check if object exists
print("Test 2: Check if object exists")
try:
    response = s3_client.head_object(Bucket=BUCKET, Key=KEY)
    print(f"✓ Object exists!")
    print(f"  Content-Type: {response.get('ContentType')}")
    print(f"  Content-Length: {response.get('ContentLength')}")
except Exception as e:
    print(f"✗ Object not found or access denied: {e}")
print()

# Test 3: Generate presigned URL
print("Test 3: Generate presigned URL")
try:
    url = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': BUCKET, 'Key': KEY},
        ExpiresIn=3600
    )
    print(f"✓ Generated presigned URL:")
    print(f"  {url}")
except Exception as e:
    print(f"✗ Failed to generate presigned URL: {e}")
print()

# Test 4: Test the presigned URL
print("Test 4: Test presigned URL with curl")
import subprocess
try:
    url = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': BUCKET, 'Key': KEY},
        ExpiresIn=3600
    )
    result = subprocess.run(['curl', '-I', url], capture_output=True, text=True, timeout=5)
    if '200 OK' in result.stdout:
        print("✓ Presigned URL works!")
    else:
        print("✗ Presigned URL failed:")
        for line in result.stdout.split('\n'):
            if 'HTTP' in line or 'Error' in line or '403' in line or '404' in line:
                print(f"  {line}")
except Exception as e:
    print(f"✗ Failed to test URL: {e}")
