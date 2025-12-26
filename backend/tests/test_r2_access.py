"""
Test R2 Access via boto3
"""
import boto3
from botocore.client import Config
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# R2 Configuration
R2_ENDPOINT = "https://4b324fd59e236f471c6ff612658615a0.r2.cloudflarestorage.com"
R2_ACCESS_KEY = "a065ad8808cb1081d8a98ecc03906025"
R2_SECRET_KEY = "6eedebd8c6cfae1bc5db45a7bab3f78ad3cf1fa0730e57130e621e1b0f8d20e8"
R2_BUCKET = "training-datasets"

def test_r2_access():
    """Test if we can access R2 directly via boto3."""
    print("=" * 60)
    print("R2 Direct Access Test")
    print("=" * 60)

    # Create S3 client
    s3_client = boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )

    # Test 1: List objects
    print("\n[Test 1] Listing objects in bucket...")
    try:
        response = s3_client.list_objects_v2(
            Bucket=R2_BUCKET,
            MaxKeys=5
        )

        if 'Contents' in response:
            print(f"[OK] Found {len(response['Contents'])} objects")
            for obj in response['Contents'][:3]:
                print(f"  - {obj['Key']} ({obj['Size']} bytes)")
        else:
            print("[FAIL] No objects found")
            return False
    except Exception as e:
        print(f"[FAIL] Error listing objects: {e}")
        return False

    # Test 2: Get object metadata
    print("\n[Test 2] Getting object metadata...")
    test_key = "datasets/ds_c75023ca76d7448b/images/images/cable/bent_wire/011.png"
    try:
        response = s3_client.head_object(
            Bucket=R2_BUCKET,
            Key=test_key
        )
        print(f"[OK] Object exists")
        print(f"  - Size: {response['ContentLength']} bytes")
        print(f"  - Content-Type: {response.get('ContentType', 'N/A')}")
        print(f"  - Last-Modified: {response.get('LastModified', 'N/A')}")
    except Exception as e:
        print(f"[FAIL] Error getting metadata: {e}")
        return False

    # Test 3: Download object
    print("\n[Test 3] Downloading object...")
    try:
        response = s3_client.get_object(
            Bucket=R2_BUCKET,
            Key=test_key
        )
        body = response['Body'].read()
        print(f"[OK] Successfully downloaded {len(body)} bytes")
    except Exception as e:
        print(f"[FAIL] Error downloading: {e}")
        return False

    # Test 4: Generate presigned URL
    print("\n[Test 4] Generating presigned URL...")
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': R2_BUCKET,
                'Key': test_key
            },
            ExpiresIn=3600
        )
        print(f"[OK] Generated presigned URL")
        print(f"  URL: {url[:100]}...")
    except Exception as e:
        print(f"[FAIL] Error generating URL: {e}")
        return False

    print("\n" + "=" * 60)
    print("[SUCCESS] All R2 access tests passed!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = test_r2_access()
    sys.exit(0 if success else 1)
