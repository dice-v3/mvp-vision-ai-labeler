"""Check image file_name in annotations.json"""

from app.db.models.platform import Dataset
from app.db.models.labeler import AnnotationProject
from app.core.database import PlatformSessionLocal, get_labeler_db
from app.api.v1.endpoints.datasets import load_annotations_from_s3

# Get database sessions
labeler_db = next(get_labeler_db())
platform_db = PlatformSessionLocal()

try:
    # Get project
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == 'proj_086e61ad81d2'
    ).first()

    if not project:
        print("Project not found")
    else:
        print(f"Project: {project.name}")
        print(f"Dataset ID: {project.dataset_id}")

        # Get dataset
        dataset = platform_db.query(Dataset).filter(
            Dataset.id == project.dataset_id
        ).first()

        if not dataset:
            print("Dataset not found")
        elif not dataset.annotation_path:
            print("No annotation_path set")
        else:
            print(f"\nDataset: {dataset.name}")
            print(f"Annotation path: {dataset.annotation_path}")

            # Load annotations
            data = load_annotations_from_s3(dataset.annotation_path)

            if data and 'images' in data:
                print(f"\nTotal images in annotations.json: {len(data['images'])}")
                print("\nFirst 5 images:")
                for img in data['images'][:5]:
                    print(f"  id={img.get('id')}, file_name={img.get('file_name')}")
            else:
                print("No images in annotations.json")

finally:
    labeler_db.close()
    platform_db.close()
