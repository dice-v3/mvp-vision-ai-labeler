"""Version diff calculation service."""

from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.models.labeler import AnnotationVersion, AnnotationSnapshot


class VersionDiffService:
    """Service for calculating diffs between annotation versions."""

    @staticmethod
    def calculate_iou(bbox1: Dict[str, Any], bbox2: Dict[str, Any]) -> float:
        """
        Calculate Intersection over Union (IoU) between two bounding boxes.

        Args:
            bbox1: First bbox with keys x, y, width, height
            bbox2: Second bbox with keys x, y, width, height

        Returns:
            IoU value between 0 and 1
        """
        # Extract coordinates
        x1_min = bbox1.get('x', 0)
        y1_min = bbox1.get('y', 0)
        x1_max = x1_min + bbox1.get('width', 0)
        y1_max = y1_min + bbox1.get('height', 0)

        x2_min = bbox2.get('x', 0)
        y2_min = bbox2.get('y', 0)
        x2_max = x2_min + bbox2.get('width', 0)
        y2_max = y2_min + bbox2.get('height', 0)

        # Calculate intersection area
        x_inter_min = max(x1_min, x2_min)
        y_inter_min = max(y1_min, y2_min)
        x_inter_max = min(x1_max, x2_max)
        y_inter_max = min(y1_max, y2_max)

        if x_inter_max < x_inter_min or y_inter_max < y_inter_min:
            return 0.0

        inter_area = (x_inter_max - x_inter_min) * (y_inter_max - y_inter_min)

        # Calculate union area
        bbox1_area = (x1_max - x1_min) * (y1_max - y1_min)
        bbox2_area = (x2_max - x2_min) * (y2_max - y2_min)
        union_area = bbox1_area + bbox2_area - inter_area

        if union_area == 0:
            return 0.0

        return inter_area / union_area

    @staticmethod
    def find_best_match(
        annotation: Dict[str, Any],
        candidates: List[Dict[str, Any]],
        iou_threshold: float = 0.5
    ) -> Optional[Tuple[Dict[str, Any], int]]:
        """
        Find the best matching annotation from candidates using IoU.

        Args:
            annotation: Source annotation
            candidates: List of candidate annotations
            iou_threshold: Minimum IoU to consider a match

        Returns:
            Tuple of (matched annotation, index) or None if no match found
        """
        # First try exact annotation_id match
        ann_id = annotation.get('annotation_id')
        if ann_id:
            for idx, candidate in enumerate(candidates):
                if candidate.get('annotation_id') == ann_id:
                    return (candidate, idx)

        # Try IoU-based matching for bbox annotations
        geometry = annotation.get('geometry', {})
        if not geometry or 'x' not in geometry:
            return None

        best_iou = 0.0
        best_match = None
        best_idx = -1

        for idx, candidate in enumerate(candidates):
            candidate_geometry = candidate.get('geometry', {})
            if 'x' not in candidate_geometry:
                continue

            iou = VersionDiffService.calculate_iou(geometry, candidate_geometry)
            if iou > best_iou and iou >= iou_threshold:
                best_iou = iou
                best_match = candidate
                best_idx = idx

        return (best_match, best_idx) if best_match else None

    @staticmethod
    def compare_annotations(
        ann_old: Dict[str, Any],
        ann_new: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compare two matched annotations and return changes.

        Args:
            ann_old: Old annotation
            ann_new: New annotation

        Returns:
            Dict with change details
        """
        changes = {}

        # Check class change
        old_class = ann_old.get('class_name') or ann_old.get('class_id')
        new_class = ann_new.get('class_name') or ann_new.get('class_id')
        if old_class != new_class:
            changes['class_changed'] = True
            changes['old_class'] = old_class
            changes['new_class'] = new_class

        # Check geometry change (position/size)
        old_geom = ann_old.get('geometry', {})
        new_geom = ann_new.get('geometry', {})

        geometry_changed = False
        if old_geom.get('x') != new_geom.get('x') or old_geom.get('y') != new_geom.get('y'):
            geometry_changed = True
            changes['position_changed'] = True

        if old_geom.get('width') != new_geom.get('width') or old_geom.get('height') != new_geom.get('height'):
            geometry_changed = True
            changes['size_changed'] = True

        if geometry_changed:
            changes['geometry_changed'] = True
            changes['old_geometry'] = old_geom
            changes['new_geometry'] = new_geom

        # Check confidence change
        if ann_old.get('confidence') != ann_new.get('confidence'):
            changes['confidence_changed'] = True
            changes['old_confidence'] = ann_old.get('confidence')
            changes['new_confidence'] = ann_new.get('confidence')

        # Check attributes change
        old_attrs = ann_old.get('attributes', {})
        new_attrs = ann_new.get('attributes', {})
        if old_attrs != new_attrs:
            changes['attributes_changed'] = True
            changes['old_attributes'] = old_attrs
            changes['new_attributes'] = new_attrs

        return changes

    @staticmethod
    def calculate_diff_for_image(
        snapshots_a: List[Dict[str, Any]],
        snapshots_b: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculate diff between two versions for a single image.

        Args:
            snapshots_a: List of annotation snapshots from version A
            snapshots_b: List of annotation snapshots from version B

        Returns:
            Dict with categorized changes
        """
        added = []
        removed = []
        modified = []
        unchanged = []

        # Deep copy to avoid modifying originals
        remaining_b = list(snapshots_b)

        # Find matches for version A annotations
        for ann_a in snapshots_a:
            match_result = VersionDiffService.find_best_match(ann_a, remaining_b)

            if not match_result:
                # No match found - annotation was removed
                removed.append(ann_a)
            else:
                ann_b, match_idx = match_result
                remaining_b.pop(match_idx)

                # Compare for changes
                changes = VersionDiffService.compare_annotations(ann_a, ann_b)

                if changes:
                    # Has changes - modified
                    modified.append({
                        'old': ann_a,
                        'new': ann_b,
                        'changes': changes
                    })
                else:
                    # No changes - unchanged
                    unchanged.append(ann_b)

        # Remaining annotations in B are new additions
        added = remaining_b

        return {
            'added': added,
            'removed': removed,
            'modified': modified,
            'unchanged': unchanged,
            'summary': {
                'added_count': len(added),
                'removed_count': len(removed),
                'modified_count': len(modified),
                'unchanged_count': len(unchanged),
                'total_changes': len(added) + len(removed) + len(modified)
            }
        }

    @staticmethod
    def get_version_snapshots(
        db: Session,
        version_id: int
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get all snapshots for a version, grouped by image_id.

        Args:
            db: Database session
            version_id: Version ID

        Returns:
            Dict mapping image_id to list of snapshots
        """
        # Get all snapshots for this version
        snapshots = db.execute(
            select(AnnotationSnapshot)
            .where(AnnotationSnapshot.version_id == version_id)
        ).scalars().all()

        # Group by image_id
        grouped = {}
        for snapshot in snapshots:
            data = snapshot.snapshot_data
            image_id = data.get('image_id')

            if not image_id:
                continue

            if image_id not in grouped:
                grouped[image_id] = []

            grouped[image_id].append(data)

        return grouped

    @staticmethod
    def calculate_version_diff(
        db: Session,
        version_a_id: int,
        version_b_id: int,
        image_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculate diff between two versions.

        Args:
            db: Database session
            version_a_id: Old version ID
            version_b_id: New version ID
            image_id: Optional - compare only this image

        Returns:
            Complete diff data with per-image and summary statistics
        """
        # Get version metadata
        version_a = db.get(AnnotationVersion, version_a_id)
        version_b = db.get(AnnotationVersion, version_b_id)

        if not version_a or not version_b:
            raise ValueError("Version not found")

        if version_a.project_id != version_b.project_id:
            raise ValueError("Versions must be from the same project")

        if version_a.task_type != version_b.task_type:
            raise ValueError("Versions must have the same task type")

        # Get snapshots
        snapshots_a = VersionDiffService.get_version_snapshots(db, version_a_id)
        snapshots_b = VersionDiffService.get_version_snapshots(db, version_b_id)

        # Filter by image_id if specified
        if image_id:
            snapshots_a = {image_id: snapshots_a.get(image_id, [])}
            snapshots_b = {image_id: snapshots_b.get(image_id, [])}

        # Calculate diff for each image
        image_diffs = {}
        all_image_ids = set(snapshots_a.keys()) | set(snapshots_b.keys())

        for img_id in all_image_ids:
            anns_a = snapshots_a.get(img_id, [])
            anns_b = snapshots_b.get(img_id, [])

            diff = VersionDiffService.calculate_diff_for_image(anns_a, anns_b)

            # Only include images with changes
            if diff['summary']['total_changes'] > 0:
                image_diffs[img_id] = diff

        # Calculate overall summary
        total_added = sum(d['summary']['added_count'] for d in image_diffs.values())
        total_removed = sum(d['summary']['removed_count'] for d in image_diffs.values())
        total_modified = sum(d['summary']['modified_count'] for d in image_diffs.values())
        total_unchanged = sum(d['summary']['unchanged_count'] for d in image_diffs.values())

        # Per-class breakdown
        class_stats = VersionDiffService._calculate_class_stats(image_diffs)

        return {
            'version_a': {
                'id': version_a.id,
                'version_number': version_a.version_number,
                'version_type': version_a.version_type,
                'created_at': version_a.created_at.isoformat(),
                'created_by': version_a.created_by
            },
            'version_b': {
                'id': version_b.id,
                'version_number': version_b.version_number,
                'version_type': version_b.version_type,
                'created_at': version_b.created_at.isoformat(),
                'created_by': version_b.created_by
            },
            'project_id': version_a.project_id,
            'task_type': version_a.task_type,
            'image_diffs': image_diffs,
            'summary': {
                'images_with_changes': len(image_diffs),
                'total_images': len(all_image_ids),
                'total_added': total_added,
                'total_removed': total_removed,
                'total_modified': total_modified,
                'total_unchanged': total_unchanged,
                'total_changes': total_added + total_removed + total_modified
            },
            'class_stats': class_stats
        }

    @staticmethod
    def _calculate_class_stats(image_diffs: Dict[str, Any]) -> Dict[str, Dict[str, int]]:
        """Calculate per-class statistics from image diffs."""
        class_stats = {}

        for diff in image_diffs.values():
            # Count added by class
            for ann in diff['added']:
                class_name = ann.get('class_name') or ann.get('class_id') or 'unknown'
                if class_name not in class_stats:
                    class_stats[class_name] = {'added': 0, 'removed': 0, 'modified': 0}
                class_stats[class_name]['added'] += 1

            # Count removed by class
            for ann in diff['removed']:
                class_name = ann.get('class_name') or ann.get('class_id') or 'unknown'
                if class_name not in class_stats:
                    class_stats[class_name] = {'added': 0, 'removed': 0, 'modified': 0}
                class_stats[class_name]['removed'] += 1

            # Count modified by class (use new class)
            for mod in diff['modified']:
                class_name = mod['new'].get('class_name') or mod['new'].get('class_id') or 'unknown'
                if class_name not in class_stats:
                    class_stats[class_name] = {'added': 0, 'removed': 0, 'modified': 0}
                class_stats[class_name]['modified'] += 1

        return class_stats
