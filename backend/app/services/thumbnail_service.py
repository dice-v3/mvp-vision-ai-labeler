"""Thumbnail Generation Service

Generates thumbnails for uploaded images to improve performance.
"""

import io
import logging
from typing import Tuple, Optional
from PIL import Image

logger = logging.getLogger(__name__)

# Thumbnail configuration
THUMBNAIL_SIZE = (256, 256)
THUMBNAIL_QUALITY = 85
THUMBNAIL_FORMAT = 'JPEG'


def create_thumbnail(
    image_bytes: bytes,
    size: Tuple[int, int] = THUMBNAIL_SIZE,
    quality: int = THUMBNAIL_QUALITY
) -> Optional[bytes]:
    """
    Create a thumbnail from image bytes.

    Args:
        image_bytes: Original image bytes
        size: Thumbnail size (width, height)
        quality: JPEG quality (1-100)

    Returns:
        Thumbnail bytes in JPEG format, or None if failed
    """
    try:
        # Open image
        img = Image.open(io.BytesIO(image_bytes))

        # Convert to RGB if necessary (handle PNG with alpha, etc.)
        if img.mode in ('RGBA', 'LA', 'P'):
            # Create white background
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            if img.mode in ('RGBA', 'LA'):
                background.paste(img, mask=img.split()[-1])  # Use alpha channel as mask
                img = background
            else:
                img = img.convert('RGB')
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        # Create thumbnail (maintains aspect ratio)
        img.thumbnail(size, Image.Resampling.LANCZOS)

        # Save to bytes
        thumb_io = io.BytesIO()
        img.save(thumb_io, THUMBNAIL_FORMAT, quality=quality, optimize=True)
        thumb_bytes = thumb_io.getvalue()

        logger.debug(f"Created thumbnail: {len(image_bytes)} bytes -> {len(thumb_bytes)} bytes")

        return thumb_bytes

    except Exception as e:
        logger.error(f"Failed to create thumbnail: {e}")
        return None


def get_thumbnail_path(image_path: str) -> str:
    """
    Get thumbnail path for an image path.

    Args:
        image_path: Original image path (e.g., 'datasets/123/images/foo.png')

    Returns:
        Thumbnail path (e.g., 'datasets/123/thumbnails/foo.jpg')
    """
    # Replace /images/ with /thumbnails/ and change extension to .jpg
    if '/images/' in image_path:
        thumbnail_path = image_path.replace('/images/', '/thumbnails/')
        # Change extension to .jpg
        if '.' in thumbnail_path:
            base = thumbnail_path.rsplit('.', 1)[0]
            thumbnail_path = f"{base}.jpg"
        else:
            thumbnail_path = f"{thumbnail_path}.jpg"
        return thumbnail_path
    else:
        # Fallback: just append _thumb.jpg
        if '.' in image_path:
            base = image_path.rsplit('.', 1)[0]
            return f"{base}_thumb.jpg"
        else:
            return f"{image_path}_thumb.jpg"
