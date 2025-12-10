"""Storage Folder Service

Provides folder structure information for datasets in S3/MinIO storage.
"""

import logging
from typing import List, Dict, Set
from collections import defaultdict

from app.core.storage import storage_client
from app.core.config import settings

logger = logging.getLogger(__name__)


class FolderInfo:
    """Folder information."""

    def __init__(self, path: str, file_count: int = 0, total_size: int = 0):
        self.path = path
        self.file_count = file_count
        self.total_size = total_size


def get_storage_structure(dataset_id: str) -> Dict:
    """
    Get folder structure for a dataset's storage.

    Args:
        dataset_id: Dataset ID

    Returns:
        Dict with folders list and statistics
    """
    try:
        # Get dataset storage path
        storage_path = f"datasets/{dataset_id}"
        images_prefix = f"{storage_path}/images/"

        # List all objects in images/ directory
        s3_client = storage_client.s3_client
        paginator = s3_client.get_paginator('list_objects_v2')

        # Track folders and their stats
        folder_stats: Dict[str, FolderInfo] = defaultdict(lambda: FolderInfo("", 0, 0))
        all_folders: Set[str] = set()
        total_files = 0
        total_size = 0

        # Iterate through all objects
        for page in paginator.paginate(
            Bucket=storage_client.datasets_bucket,
            Prefix=images_prefix
        ):
            if 'Contents' not in page:
                continue

            for obj in page['Contents']:
                key = obj['Key']
                size = obj['Size']

                # Skip thumbnails directory
                if '/thumbnails/' in key:
                    continue

                # Extract relative path from images/
                if images_prefix in key:
                    relative_path = key[len(images_prefix):]
                else:
                    continue

                # Skip if it's just the prefix itself
                if not relative_path:
                    continue

                total_files += 1
                total_size += size

                # Extract folder path(s)
                if '/' in relative_path:
                    parts = relative_path.split('/')
                    # Build all parent folders
                    for i in range(1, len(parts)):
                        folder_path = '/'.join(parts[:i]) + '/'
                        all_folders.add(folder_path)
                        folder_stats[folder_path].path = folder_path
                        folder_stats[folder_path].file_count += 1
                        folder_stats[folder_path].total_size += size
                else:
                    # File in root
                    folder_stats['/'].path = '/'
                    folder_stats['/'].file_count += 1
                    folder_stats['/'].total_size += size

        # Convert to sorted list
        folders = []

        # Add root if it has files
        if '/' in folder_stats:
            folders.append({
                'path': '/',
                'name': '(루트)',
                'file_count': folder_stats['/'].file_count,
                'total_size_bytes': folder_stats['/'].total_size,
                'depth': 0
            })

        # Add other folders sorted by path
        for folder_path in sorted(all_folders):
            info = folder_stats[folder_path]
            depth = folder_path.count('/')
            name = folder_path.rstrip('/').split('/')[-1]

            folders.append({
                'path': folder_path,
                'name': name,
                'file_count': info.file_count,
                'total_size_bytes': info.total_size,
                'depth': depth
            })

        return {
            'dataset_id': dataset_id,
            'total_files': total_files,
            'total_size_bytes': total_size,
            'folders': folders
        }

    except Exception as e:
        logger.error(f"Failed to get storage structure for dataset {dataset_id}: {e}")
        raise


def preview_upload_structure(
    dataset_id: str,
    file_mappings: List[Dict[str, str]],
    target_folder: str = ""
) -> Dict:
    """
    Preview what the storage structure will look like after upload.

    Args:
        dataset_id: Dataset ID
        file_mappings: List of {filename, relative_path, size}
        target_folder: Target folder in storage (e.g., "train/")

    Returns:
        Dict with preview structure
    """
    # Get current structure
    current = get_storage_structure(dataset_id)
    current_files = set()

    # Build set of existing files
    try:
        storage_path = f"datasets/{dataset_id}"
        images_prefix = f"{storage_path}/images/"

        s3_client = storage_client.s3_client
        paginator = s3_client.get_paginator('list_objects_v2')

        for page in paginator.paginate(
            Bucket=storage_client.datasets_bucket,
            Prefix=images_prefix
        ):
            if 'Contents' not in page:
                continue

            for obj in page['Contents']:
                key = obj['Key']
                if '/thumbnails/' in key:
                    continue
                if images_prefix in key:
                    relative_path = key[len(images_prefix):]
                    if relative_path:
                        current_files.add(relative_path)

    except Exception as e:
        logger.warning(f"Could not fetch existing files: {e}")

    # Analyze new files
    new_files = []
    duplicate_files = []

    for mapping in file_mappings:
        relative_path = mapping.get('relative_path', '')

        # Apply target folder
        if target_folder:
            final_path = f"{target_folder.rstrip('/')}/{relative_path}"
        else:
            final_path = relative_path

        file_info = {
            'filename': mapping.get('filename', ''),
            'path': final_path,
            'size': mapping.get('size', 0),
        }

        if final_path in current_files:
            file_info['status'] = 'duplicate'
            duplicate_files.append(file_info)
        else:
            file_info['status'] = 'new'
            new_files.append(file_info)

    return {
        'dataset_id': dataset_id,
        'target_folder': target_folder,
        'current_structure': current,
        'new_files': new_files,
        'duplicate_files': duplicate_files,
        'summary': {
            'total_new': len(new_files),
            'total_duplicates': len(duplicate_files),
            'total_files': len(file_mappings)
        }
    }
