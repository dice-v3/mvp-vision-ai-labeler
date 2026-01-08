"""
Script to create text_label_versions table directly using SQLAlchemy.
This bypasses alembic connection issues.
"""

from app.core.database import labeler_engine
from app.db.models.labeler import TextLabelVersion

def create_table():
    """Create text_label_versions table in the labeler database."""
    print("Creating text_label_versions table...")
    print(f"Database: {labeler_engine.url}")

    # Create only the TextLabelVersion table
    TextLabelVersion.__table__.create(labeler_engine, checkfirst=True)

    print("✅ Table created successfully!")
    print("\nTable details:")
    print(f"  Name: {TextLabelVersion.__tablename__}")
    print(f"  Columns: {list(TextLabelVersion.__table__.columns.keys())}")
    print(f"  Indexes: {[idx.name for idx in TextLabelVersion.__table__.indexes]}")

if __name__ == "__main__":
    create_table()
