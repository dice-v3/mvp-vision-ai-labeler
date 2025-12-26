"""
Update project task_types to include detection.

This script updates a project's task_types to include 'detection'
so that users can switch to detection mode in the UI.
"""

import sys
from app.core.database import SessionLocal, PlatformSessionLocal
from app.db.models.labeler import AnnotationProject

def update_project_task_types(project_id: str):
    """Update project task_types to include detection."""
    labeler_db = SessionLocal()

    try:
        # Get project
        project = labeler_db.query(AnnotationProject).filter(
            AnnotationProject.id == project_id
        ).first()

        if not project:
            print(f"❌ Project {project_id} not found")
            return

        print(f"\n📋 Current project: {project.name}")
        print(f"   ID: {project.id}")
        print(f"   Dataset ID: {project.dataset_id}")
        print(f"   Current task_types: {project.task_types}")

        # Update task_types to include detection if not already present
        if 'detection' not in project.task_types:
            project.task_types = ['classification', 'detection']

            # Initialize task_classes if not exists
            if not project.task_classes:
                project.task_classes = {}

            # Copy classes to both tasks if they don't exist
            if 'detection' not in project.task_classes and project.classes:
                project.task_classes['detection'] = project.classes.copy()
            if 'classification' not in project.task_classes and project.classes:
                project.task_classes['classification'] = project.classes.copy()

            # Initialize task_config if needed
            if not project.task_config:
                project.task_config = {}

            if 'detection' not in project.task_config:
                project.task_config['detection'] = {
                    'show_labels': True,
                    'show_confidence': False,
                }
            if 'classification' not in project.task_config:
                project.task_config['classification'] = {
                    'multi_label': False,
                    'show_confidence': False,
                }

            labeler_db.commit()
            labeler_db.refresh(project)

            print(f"\n✅ Updated task_types: {project.task_types}")
            print(f"   task_classes keys: {list(project.task_classes.keys())}")
            print(f"   task_config keys: {list(project.task_config.keys())}")
        else:
            print(f"\n✓ Project already has 'detection' in task_types")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        labeler_db.rollback()
    finally:
        labeler_db.close()


def list_projects():
    """List all projects."""
    labeler_db = SessionLocal()

    try:
        projects = labeler_db.query(AnnotationProject).all()

        if not projects:
            print("No projects found")
            return

        print("\n📋 Available projects:")
        print("-" * 80)
        for p in projects:
            print(f"  ID: {p.id}")
            print(f"  Name: {p.name}")
            print(f"  Dataset ID: {p.dataset_id}")
            print(f"  Task types: {p.task_types}")
            print("-" * 80)

    finally:
        labeler_db.close()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python update_project_task_types.py list              # List all projects")
        print("  python update_project_task_types.py <project_id>      # Update project task types")
        sys.exit(1)

    command = sys.argv[1]

    if command == 'list':
        list_projects()
    else:
        project_id = command
        update_project_task_types(project_id)
