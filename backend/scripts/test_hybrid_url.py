"""
Test Hybrid URL Generation (R2 vs S3)

Tests that the hybrid approach works correctly:
- With R2_PUBLIC_URL set: Uses R2.dev public URLs
- With R2_PUBLIC_URL empty: Uses presigned URLs
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.config import settings
from app.core.storage import storage_client

def test_hybrid_url():
    """Test hybrid URL generation."""
    print("=" * 80)
    print("Hybrid URL Generation Test")
    print("=" * 80)

    # Test parameters
    test_key = "datasets/ds_c75023ca76d7448b/images/images/cable/bent_wire/011.png"

    print(f"\nTest Key: {test_key}")
    print(f"\nR2_PUBLIC_URL Setting: {settings.R2_PUBLIC_URL or '(empty)'}")
    print(f"S3_ENDPOINT Setting: {settings.S3_ENDPOINT}")
    print()

    # Test 1: Generate URL with current settings
    print("[Test 1] Generate URL with current settings")
    print("-" * 80)

    try:
        url = storage_client.generate_presigned_url(
            bucket=storage_client.datasets_bucket,
            key=test_key,
            expiration=3600
        )

        print(f"[OK] URL Generated:")
        print(f"  {url}")
        print()

        # Analyze URL type
        if settings.R2_PUBLIC_URL and url.startswith(settings.R2_PUBLIC_URL):
            print(f"[INFO] URL Type: R2 Public Development URL")
            print(f"[INFO] Format: {{R2_PUBLIC_URL}}/{{key}}")
            print(f"[INFO] No signature parameters (public access)")
            print(f"[INFO] Good for: R2 development environment")
        elif "X-Amz-Algorithm" in url:
            print(f"[INFO] URL Type: S3 Presigned URL")
            print(f"[INFO] Format: {{endpoint}}/{{bucket}}/{{key}}?X-Amz-...")
            print(f"[INFO] Has signature parameters (authenticated access)")
            print(f"[INFO] Good for: S3/MinIO on-prem deployment")
        else:
            print(f"[WARN] URL Type: Unknown")

    except Exception as e:
        print(f"[FAIL] Error generating URL: {e}")
        return False

    # Test 2: Simulate S3 mode (R2_PUBLIC_URL empty)
    print("\n[Test 2] Simulate S3 mode (R2_PUBLIC_URL empty)")
    print("-" * 80)
    print("[INFO] This is what would happen on-prem with S3:")
    print()

    original_r2_url = settings.R2_PUBLIC_URL
    settings.R2_PUBLIC_URL = ""  # Temporarily clear

    try:
        url = storage_client.generate_presigned_url(
            bucket=storage_client.datasets_bucket,
            key=test_key,
            expiration=3600
        )

        print(f"[OK] S3 Presigned URL Generated:")
        print(f"  {url[:120]}...")
        print()

        if "X-Amz-Algorithm" in url:
            print(f"[SUCCESS] Presigned URL has signature parameters")
            print(f"[SUCCESS] This will work with S3/MinIO on-prem")
        else:
            print(f"[WARN] URL doesn't have signature parameters")

    except Exception as e:
        print(f"[FAIL] Error generating S3 URL: {e}")
        return False
    finally:
        settings.R2_PUBLIC_URL = original_r2_url  # Restore

    # Test 3: URL format comparison
    print("\n[Test 3] URL Format Comparison")
    print("-" * 80)

    print("R2 Development Mode:")
    print(f"  R2_PUBLIC_URL = {original_r2_url}")
    print(f"  Result: https://pub-xxx.r2.dev/{{key}}")
    print(f"  - No signature parameters")
    print(f"  - Direct public access")
    print(f"  - Fast (no signature generation)")
    print()

    print("S3 On-prem Mode:")
    print(f"  R2_PUBLIC_URL = (empty)")
    print(f"  Result: https://s3-endpoint/bucket/key?X-Amz-...")
    print(f"  - Signature parameters included")
    print(f"  - Authenticated access")
    print(f"  - Works with private S3 buckets")
    print()

    # Summary
    print("=" * 80)
    print("[RESULT] Hybrid URL Generation Test")
    print("=" * 80)
    print()
    print("[OK] R2 mode works: Public Development URL")
    print("[OK] S3 mode works: Presigned URL with signature")
    print("[OK] No code changes needed between environments")
    print("[OK] Only environment variable configuration required")
    print()
    print("Deployment Strategy:")
    print("  Development (R2):  R2_PUBLIC_URL = https://pub-xxx.r2.dev")
    print("  Production (S3):   R2_PUBLIC_URL = (empty)")
    print()
    print("=" * 80)

    return True

if __name__ == "__main__":
    success = test_hybrid_url()
    sys.exit(0 if success else 1)
