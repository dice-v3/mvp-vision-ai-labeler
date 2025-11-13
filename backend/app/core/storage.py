"""
Storage Client for S3/MinIO

Handles image storage operations including:
- List images from datasets
- Generate presigned URLs
- Upload/download annotations
"""

import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageClient:
    """S3/MinIO storage client for managing images and annotations."""

    def __init__(self):
        """Initialize S3 client with configuration from settings."""
        self.s3_client = boto3.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            config=Config(signature_version='s3v4'),
            use_ssl=settings.S3_USE_SSL
        )
        self.datasets_bucket = settings.S3_BUCKET_DATASETS
        self.annotations_bucket = settings.S3_BUCKET_ANNOTATIONS
        logger.info(f"Storage client initialized: endpoint={settings.S3_ENDPOINT}")

    def list_dataset_images(
        self,
        dataset_id: str,
        prefix: str = "images/",
        max_keys: int = 1000
    ) -> List[Dict[str, any]]:
        """
        List all images in a dataset.

        Args:
            dataset_id: Dataset ID
            prefix: Folder prefix (default: "images/")
            max_keys: Maximum number of objects to return

        Returns:
            List of image metadata dicts with keys:
            - key: S3 object key
            - filename: Original filename
            - size: File size in bytes
            - last_modified: Last modified timestamp
            - url: Presigned URL (valid for 1 hour)
        """
        try:
            # Storage structure: datasets/{dataset_id}/images/xxx.jpg
            s3_prefix = f"{dataset_id}/{prefix}"

            logger.info(f"Listing images: bucket={self.datasets_bucket}, prefix={s3_prefix}")

            response = self.s3_client.list_objects_v2(
                Bucket=self.datasets_bucket,
                Prefix=s3_prefix,
                MaxKeys=max_keys
            )

            if 'Contents' not in response:
                logger.warning(f"No images found in {s3_prefix}")
                return []

            images = []
            for obj in response['Contents']:
                key = obj['Key']

                # Skip folders (keys ending with /)
                if key.endswith('/'):
                    continue

                # Extract filename from key (e.g., "ds_123/images/photo.jpg" -> "photo.jpg")
                filename = key.split('/')[-1]

                # Skip non-image files
                if not self._is_image_file(filename):
                    continue

                # Generate presigned URL (valid for 1 hour)
                presigned_url = self.generate_presigned_url(
                    bucket=self.datasets_bucket,
                    key=key,
                    expiration=3600
                )

                images.append({
                    'key': key,
                    'filename': filename,
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'url': presigned_url
                })

            logger.info(f"Found {len(images)} images in {dataset_id}")
            return images

        except ClientError as e:
            logger.error(f"Failed to list images in {dataset_id}: {e}")
            raise Exception(f"Failed to list images: {str(e)}")

    def generate_presigned_url(
        self,
        bucket: str,
        key: str,
        expiration: int = 3600
    ) -> str:
        """
        Generate a presigned URL for accessing an object.

        Args:
            bucket: Bucket name
            key: Object key
            expiration: URL expiration time in seconds (default: 1 hour)

        Returns:
            Presigned URL string
        """
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket, 'Key': key},
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL for {key}: {e}")
            raise Exception(f"Failed to generate presigned URL: {str(e)}")

    def get_image_url(self, dataset_id: str, filename: str, expiration: int = 3600) -> str:
        """
        Get presigned URL for a specific image.

        Args:
            dataset_id: Dataset ID
            filename: Image filename
            expiration: URL expiration time in seconds

        Returns:
            Presigned URL string
        """
        key = f"{dataset_id}/images/{filename}"
        return self.generate_presigned_url(
            bucket=self.datasets_bucket,
            key=key,
            expiration=expiration
        )

    def upload_annotation(
        self,
        dataset_id: str,
        annotation_data: bytes,
        filename: str = "annotations.json"
    ) -> str:
        """
        Upload annotation data to S3.

        Args:
            dataset_id: Dataset ID
            annotation_data: Annotation JSON as bytes
            filename: Filename (default: "annotations.json")

        Returns:
            S3 object key
        """
        try:
            key = f"{dataset_id}/{filename}"

            self.s3_client.put_object(
                Bucket=self.annotations_bucket,
                Key=key,
                Body=annotation_data,
                ContentType='application/json',
                Metadata={
                    'dataset_id': dataset_id,
                    'uploaded_at': datetime.utcnow().isoformat()
                }
            )

            logger.info(f"Uploaded annotation: {key}")
            return key

        except ClientError as e:
            logger.error(f"Failed to upload annotation for {dataset_id}: {e}")
            raise Exception(f"Failed to upload annotation: {str(e)}")

    def download_annotation(self, dataset_id: str, filename: str = "annotations.json") -> Optional[bytes]:
        """
        Download annotation data from S3.

        Args:
            dataset_id: Dataset ID
            filename: Filename (default: "annotations.json")

        Returns:
            Annotation data as bytes, or None if not found
        """
        try:
            key = f"{dataset_id}/{filename}"

            response = self.s3_client.get_object(
                Bucket=self.annotations_bucket,
                Key=key
            )

            data = response['Body'].read()
            logger.info(f"Downloaded annotation: {key} ({len(data)} bytes)")
            return data

        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                logger.warning(f"Annotation not found: {dataset_id}/{filename}")
                return None
            logger.error(f"Failed to download annotation for {dataset_id}: {e}")
            raise Exception(f"Failed to download annotation: {str(e)}")

    def _is_image_file(self, filename: str) -> bool:
        """Check if filename is an image file based on extension."""
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'}
        return any(filename.lower().endswith(ext) for ext in image_extensions)

    def check_bucket_exists(self, bucket: str) -> bool:
        """Check if a bucket exists and is accessible."""
        try:
            self.s3_client.head_bucket(Bucket=bucket)
            return True
        except ClientError:
            return False


# Global storage client instance
storage_client = StorageClient()
