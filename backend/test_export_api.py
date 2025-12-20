"""
Test script for Phase 19.5 - VLM Text Label Export Integration (API-based)

This script tests the export functionality through the API endpoints.
"""

import requests
import json
import zipfile
import io
import sys
import os

# Set UTF-8 encoding for Windows
if sys.platform == "win32":
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "http://localhost:8000/api/v1"

# Test credentials (adjust as needed)
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "test123"


def get_auth_token():
    """Get authentication token."""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            token = response.json().get("access_token")
            print(f"✅ Authenticated as {TEST_EMAIL}")
            return token
        else:
            print(f"⚠️  Authentication failed: {response.status_code}")
            print("   Attempting to get projects without auth...")
            return None
    except Exception as e:
        print(f"⚠️  Could not authenticate: {e}")
        print("   Attempting to continue without auth...")
        return None


def get_headers(token=None):
    """Get request headers."""
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def get_projects(token=None):
    """Get list of projects."""
    try:
        response = requests.get(
            f"{BASE_URL}/projects",
            headers=get_headers(token)
        )
        if response.status_code == 200:
            projects = response.json()
            print(f"✅ Found {len(projects)} projects")
            return projects
        else:
            print(f"❌ Failed to get projects: {response.status_code}")
            return []
    except Exception as e:
        print(f"❌ Error getting projects: {e}")
        return []


def create_sample_text_labels(project_id, token=None):
    """Create sample text labels via API."""
    print(f"\n{'='*60}")
    print("Creating Sample Text Labels")
    print(f"{'='*60}")

    # First, get annotations from the project
    try:
        response = requests.get(
            f"{BASE_URL}/projects/{project_id}/annotations",
            headers=get_headers(token),
            params={"limit": 5}
        )
        if response.status_code != 200:
            print(f"❌ Failed to get annotations: {response.status_code}")
            return False

        annotations = response.json()
        if not annotations:
            print("❌ No annotations found in project")
            return False

        # Get unique image IDs
        image_ids = list(set([ann["image_id"] for ann in annotations]))
        print(f"✅ Found {len(annotations)} annotations across {len(image_ids)} images")

        # Create text labels
        labels_created = 0

        # Image-level caption
        if len(image_ids) >= 1:
            label_data = {
                "image_id": image_ids[0],
                "label_type": "caption",
                "text_content": "A test image showing object detection annotations",
                "language": "en",
                "confidence": 0.95
            }
            response = requests.post(
                f"{BASE_URL}/projects/{project_id}/text-labels",
                headers=get_headers(token),
                json=label_data
            )
            if response.status_code in [200, 201]:
                labels_created += 1
                print(f"   ✅ Created image-level caption for {image_ids[0][:30]}...")

        # Image-level VQA
        if len(image_ids) >= 2:
            label_data = {
                "image_id": image_ids[1],
                "label_type": "qa",
                "question": "What objects are visible in this image?",
                "text_content": "The image contains annotated objects including boxes and labels",
                "language": "en",
                "confidence": 0.88
            }
            response = requests.post(
                f"{BASE_URL}/projects/{project_id}/text-labels",
                headers=get_headers(token),
                json=label_data
            )
            if response.status_code in [200, 201]:
                labels_created += 1
                print(f"   ✅ Created VQA pair for {image_ids[1][:30]}...")

        # Region-level label
        if len(annotations) >= 1:
            label_data = {
                "image_id": annotations[0]["image_id"],
                "annotation_id": annotations[0]["id"],
                "label_type": "region_description",
                "text_content": "This is the main object in the upper left region",
                "language": "en",
                "confidence": 0.92
            }
            response = requests.post(
                f"{BASE_URL}/projects/{project_id}/text-labels",
                headers=get_headers(token),
                json=label_data
            )
            if response.status_code in [200, 201]:
                labels_created += 1
                print(f"   ✅ Created region-level label for annotation {annotations[0]['id']}")

        print(f"\n✅ Created {labels_created} sample text labels")
        return labels_created > 0

    except Exception as e:
        print(f"❌ Error creating text labels: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_dice_export(project_id, token=None):
    """Test DICE export."""
    print(f"\n{'='*60}")
    print("Testing DICE Export")
    print(f"{'='*60}")

    try:
        response = requests.post(
            f"{BASE_URL}/export/dice",
            headers=get_headers(token),
            json={
                "project_id": project_id,
                "include_draft": False
            }
        )

        if response.status_code == 200:
            dice_data = response.json()
            images = dice_data.get("images", [])

            # Check for text labels
            images_with_captions = sum(1 for img in images if "image_captions" in img)
            images_with_vqa = sum(1 for img in images if "vqa_pairs" in img)
            anns_with_text = 0
            for img in images:
                for ann in img.get("annotations", []):
                    if "text_labels" in ann:
                        anns_with_text += 1

            print(f"✅ DICE export successful:")
            print(f"   - Total images: {len(images)}")
            print(f"   - Images with captions: {images_with_captions}")
            print(f"   - Images with VQA pairs: {images_with_vqa}")
            print(f"   - Annotations with text labels: {anns_with_text}")

            # Sample output
            if images_with_captions > 0:
                sample_img = next(img for img in images if "image_captions" in img)
                print(f"\n   Sample caption: {sample_img['image_captions'][0]['text'][:60]}...")

            return True
        else:
            print(f"❌ DICE export failed: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False

    except Exception as e:
        print(f"❌ Error testing DICE export: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_coco_export(project_id, token=None):
    """Test COCO export."""
    print(f"\n{'='*60}")
    print("Testing COCO Export")
    print(f"{'='*60}")

    try:
        response = requests.post(
            f"{BASE_URL}/export/coco",
            headers=get_headers(token),
            json={
                "project_id": project_id,
                "include_draft": False
            }
        )

        if response.status_code == 200:
            coco_data = response.json()

            caption_count = len(coco_data.get("captions", []))
            region_desc_count = len(coco_data.get("region_descriptions", []))
            vqa_count = len(coco_data.get("vqa", []))

            print(f"✅ COCO export successful:")
            print(f"   - Images: {len(coco_data.get('images', []))}")
            print(f"   - Annotations: {len(coco_data.get('annotations', []))}")
            print(f"   - Captions: {caption_count}")
            print(f"   - Region descriptions: {region_desc_count}")
            print(f"   - VQA pairs: {vqa_count}")

            # Sample output
            if caption_count > 0:
                sample_caption = coco_data["captions"][0]
                print(f"\n   Sample caption: {sample_caption['caption'][:60]}...")

            if vqa_count > 0:
                sample_vqa = coco_data["vqa"][0]
                print(f"   Sample VQA Q: {sample_vqa['question'][:50]}...")
                print(f"   Sample VQA A: {sample_vqa['answer'][:50]}...")

            return True
        else:
            print(f"❌ COCO export failed: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False

    except Exception as e:
        print(f"❌ Error testing COCO export: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_yolo_export(project_id, token=None):
    """Test YOLO export."""
    print(f"\n{'='*60}")
    print("Testing YOLO Export")
    print(f"{'='*60}")

    try:
        response = requests.post(
            f"{BASE_URL}/export/yolo",
            headers=get_headers(token),
            json={
                "project_id": project_id,
                "include_draft": False
            },
            stream=True
        )

        if response.status_code == 200:
            # Parse ZIP file
            zip_data = io.BytesIO(response.content)
            with zipfile.ZipFile(zip_data, 'r') as zip_file:
                file_list = zip_file.namelist()

                # Count different file types
                label_files = [f for f in file_list if f.startswith('labels/')]
                caption_files = [f for f in file_list if f.startswith('captions/')]
                region_desc_files = [f for f in file_list if f.startswith('region_descriptions/')]
                vqa_files = [f for f in file_list if f.startswith('vqa/')]
                classes_file = 'classes.txt' in file_list

                print(f"✅ YOLO export successful:")
                print(f"   - Label files: {len(label_files)}")
                print(f"   - Caption files: {len(caption_files)}")
                print(f"   - Region description files: {len(region_desc_files)}")
                print(f"   - VQA files: {len(vqa_files)}")
                print(f"   - classes.txt: {'✓' if classes_file else '✗'}")

                # Sample output
                if caption_files:
                    caption_file = caption_files[0]
                    with zip_file.open(caption_file) as f:
                        captions = json.load(f)
                        print(f"\n   Sample caption file ({caption_file}):")
                        print(f"   {json.dumps(captions[0], indent=2)[:100]}...")

                if vqa_files:
                    vqa_file = vqa_files[0]
                    with zip_file.open(vqa_file) as f:
                        vqa_pairs = json.load(f)
                        print(f"\n   Sample VQA file ({vqa_file}):")
                        print(f"   Question: {vqa_pairs[0]['question']}")

            return True
        else:
            print(f"❌ YOLO export failed: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False

    except Exception as e:
        print(f"❌ Error testing YOLO export: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main test function."""
    print("\n" + "="*60)
    print("Phase 19.5 - VLM Text Label Export Integration Test")
    print("(API-based)")
    print("="*60 + "\n")

    # Get auth token (optional)
    token = get_auth_token()

    # Get projects
    projects = get_projects(token)
    if not projects:
        print("\n❌ No projects found. Please create a project with annotations first.")
        return

    # Use first project
    project = projects[0]
    project_id = project["id"]
    print(f"\n📌 Testing with project: {project['name']} (ID: {project_id})")

    # Create sample text labels
    if not create_sample_text_labels(project_id, token):
        print("\n⚠️  Could not create sample text labels. Testing with existing data...")

    # Test exports
    results = {
        "DICE": test_dice_export(project_id, token),
        "COCO": test_coco_export(project_id, token),
        "YOLO": test_yolo_export(project_id, token),
    }

    # Summary
    print("\n" + "="*60)
    print("Test Summary")
    print("="*60)
    for format_name, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{format_name} Export: {status}")

    all_passed = all(results.values())
    if all_passed:
        print("\n🎉 All export tests passed!")
    else:
        print("\n⚠️  Some tests failed. Please check the output above.")


if __name__ == "__main__":
    main()
