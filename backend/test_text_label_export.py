"""
Test script for Phase 19.5 - VLM Text Label Export Integration

This script:
1. Finds an existing project with annotations
2. Creates sample text labels (image-level and region-level)
3. Tests DICE, COCO, and YOLO exports
4. Verifies text labels are included in exports
"""

import sys
import json
from pathlib import Path
from sqlalchemy.orm import Session

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import LabelerSessionLocal, PlatformSessionLocal
from app.db.models.labeler import AnnotationProject, Annotation, TextLabel
from app.services.dice_export_service import export_to_dice
from app.services.coco_export_service import export_to_coco
from app.services.yolo_export_service import export_to_yolo


def get_test_project(db: Session):
    """Find a project with at least one annotation."""
    project = db.query(AnnotationProject).join(Annotation).first()
    if not project:
        print("❌ No project with annotations found")
        return None

    print(f"✅ Found project: {project.name} (ID: {project.id})")
    return project


def get_test_images_and_annotations(db: Session, project_id: str):
    """Get sample images and annotations from project."""
    annotations = db.query(Annotation).filter(
        Annotation.project_id == project_id
    ).limit(3).all()

    if not annotations:
        print("❌ No annotations found in project")
        return [], []

    image_ids = list(set([ann.image_id for ann in annotations]))
    print(f"✅ Found {len(annotations)} annotations across {len(image_ids)} images")

    return image_ids, annotations


def create_sample_text_labels(db: Session, project_id: str, image_ids: list, annotations: list):
    """Create sample text labels for testing."""
    # Delete existing test text labels to avoid duplicates
    db.query(TextLabel).filter(
        TextLabel.project_id == project_id
    ).delete()
    db.commit()

    created_labels = []

    # Create image-level labels
    if len(image_ids) >= 1:
        # Caption
        label1 = TextLabel(
            project_id=project_id,
            image_id=image_ids[0],
            label_type="caption",
            text_content="A test image showing object detection annotations",
            language="en",
            confidence=0.95,
        )
        db.add(label1)
        created_labels.append(("image-level caption", image_ids[0]))

        # Description
        label2 = TextLabel(
            project_id=project_id,
            image_id=image_ids[0],
            label_type="description",
            text_content="This image contains multiple objects that have been annotated with bounding boxes",
            language="en",
            confidence=0.90,
        )
        db.add(label2)
        created_labels.append(("image-level description", image_ids[0]))

    if len(image_ids) >= 2:
        # VQA pair
        label3 = TextLabel(
            project_id=project_id,
            image_id=image_ids[1],
            label_type="qa",
            question="What objects are visible in this image?",
            text_content="The image contains annotated objects including boxes and labels",
            language="en",
            confidence=0.88,
        )
        db.add(label3)
        created_labels.append(("VQA pair", image_ids[1]))

    # Create region-level labels (linked to annotations)
    if len(annotations) >= 1:
        label4 = TextLabel(
            project_id=project_id,
            image_id=annotations[0].image_id,
            annotation_id=annotations[0].id,
            label_type="region_description",
            text_content="This is the main object in the upper left region",
            language="en",
            confidence=0.92,
        )
        db.add(label4)
        created_labels.append(("region-level", f"annotation {annotations[0].id}"))

    if len(annotations) >= 2:
        label5 = TextLabel(
            project_id=project_id,
            image_id=annotations[1].image_id,
            annotation_id=annotations[1].id,
            label_type="region_description",
            text_content="A secondary object located in the center of the image",
            language="en",
            confidence=0.85,
        )
        db.add(label5)
        created_labels.append(("region-level", f"annotation {annotations[1].id}"))

    db.commit()

    print(f"\n✅ Created {len(created_labels)} sample text labels:")
    for label_type, location in created_labels:
        print(f"   - {label_type}: {location}")

    return len(created_labels)


def test_dice_export(db: Session, platform_db: Session, project_id: str):
    """Test DICE export with text labels."""
    print("\n" + "="*60)
    print("Testing DICE Export")
    print("="*60)

    try:
        dice_data = export_to_dice(
            db=db,
            platform_db=platform_db,
            project_id=project_id,
            include_draft=False,
        )

        # Check for text labels in export
        image_count = len(dice_data.get("images", []))
        print(f"✅ DICE export successful: {image_count} images")

        # Check image-level text labels
        images_with_captions = sum(1 for img in dice_data.get("images", []) if "image_captions" in img)
        images_with_vqa = sum(1 for img in dice_data.get("images", []) if "vqa_pairs" in img)

        print(f"   - Images with captions: {images_with_captions}")
        print(f"   - Images with VQA pairs: {images_with_vqa}")

        # Check region-level text labels
        annotations_with_text = 0
        for img in dice_data.get("images", []):
            for ann in img.get("annotations", []):
                if "text_labels" in ann:
                    annotations_with_text += 1

        print(f"   - Annotations with text labels: {annotations_with_text}")

        # Sample output
        if images_with_captions > 0:
            sample_img = next(img for img in dice_data["images"] if "image_captions" in img)
            print(f"\n   Sample caption: {sample_img['image_captions'][0]['text'][:60]}...")

        return True

    except Exception as e:
        print(f"❌ DICE export failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_coco_export(db: Session, platform_db: Session, project_id: str):
    """Test COCO export with text labels."""
    print("\n" + "="*60)
    print("Testing COCO Export")
    print("="*60)

    try:
        coco_data = export_to_coco(
            db=db,
            platform_db=platform_db,
            project_id=project_id,
            include_draft=False,
        )

        image_count = len(coco_data.get("images", []))
        annotation_count = len(coco_data.get("annotations", []))
        caption_count = len(coco_data.get("captions", []))
        region_desc_count = len(coco_data.get("region_descriptions", []))
        vqa_count = len(coco_data.get("vqa", []))

        print(f"✅ COCO export successful:")
        print(f"   - Images: {image_count}")
        print(f"   - Annotations: {annotation_count}")
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

    except Exception as e:
        print(f"❌ COCO export failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_yolo_export(db: Session, project_id: str):
    """Test YOLO export with text labels."""
    print("\n" + "="*60)
    print("Testing YOLO Export")
    print("="*60)

    try:
        image_annotations, classes_txt, captions_files, region_desc_files, vqa_files = export_to_yolo(
            db=db,
            project_id=project_id,
            include_draft=False,
        )

        print(f"✅ YOLO export successful:")
        print(f"   - Annotation files: {len(image_annotations)}")
        print(f"   - Caption files: {len(captions_files)}")
        print(f"   - Region description files: {len(region_desc_files)}")
        print(f"   - VQA files: {len(vqa_files)}")
        print(f"   - Classes: {len(classes_txt.split(chr(10))) if classes_txt else 0}")

        # Sample output
        if captions_files:
            sample_image_id = list(captions_files.keys())[0]
            captions_json = json.loads(captions_files[sample_image_id])
            print(f"\n   Sample caption file ({sample_image_id}):")
            print(f"   {json.dumps(captions_json[0], indent=2)[:100]}...")

        if vqa_files:
            sample_image_id = list(vqa_files.keys())[0]
            vqa_json = json.loads(vqa_files[sample_image_id])
            print(f"\n   Sample VQA file ({sample_image_id}):")
            print(f"   Question: {vqa_json[0]['question']}")

        return True

    except Exception as e:
        print(f"❌ YOLO export failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main test function."""
    print("\n" + "="*60)
    print("Phase 19.5 - VLM Text Label Export Integration Test")
    print("="*60 + "\n")

    # Create database sessions
    db = LabelerSessionLocal()
    platform_db = PlatformSessionLocal()

    try:
        # 1. Find test project
        project = get_test_project(db)
        if not project:
            return

        # 2. Get sample images and annotations
        image_ids, annotations = get_test_images_and_annotations(db, project.id)
        if not image_ids:
            return

        # 3. Create sample text labels
        label_count = create_sample_text_labels(db, project.id, image_ids, annotations)
        if label_count == 0:
            print("❌ Failed to create sample text labels")
            return

        # 4. Test exports
        results = {
            "DICE": test_dice_export(db, platform_db, project.id),
            "COCO": test_coco_export(db, platform_db, project.id),
            "YOLO": test_yolo_export(db, project.id),
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

    finally:
        db.close()
        platform_db.close()


if __name__ == "__main__":
    main()
