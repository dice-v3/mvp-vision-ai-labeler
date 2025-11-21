"""Check if datasets table exists in Labeler DB"""
from sqlalchemy import text
from app.core.database import labeler_engine

with labeler_engine.connect() as conn:
    # Check if datasets table exists
    result = conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'datasets')"
    ))
    datasets_exists = result.scalar()
    print(f"datasets table exists: {datasets_exists}")

    # Check if ix_datasets_owner_id index exists
    result = conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'ix_datasets_owner_id')"
    ))
    index_exists = result.scalar()
    print(f"ix_datasets_owner_id index exists: {index_exists}")

    # If index exists without table, drop it
    if index_exists and not datasets_exists:
        print("WARNING: Index exists without table! Dropping...")
        conn.execute(text("DROP INDEX IF EXISTS ix_datasets_owner_id"))
        conn.commit()
        print("Index dropped.")
