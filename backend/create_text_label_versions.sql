-- Create text_label_versions table for Phase 19.8
-- Run this with: docker exec -i <postgres_container> psql -U admin -d labeler < create_text_label_versions.sql

CREATE TABLE IF NOT EXISTS text_label_versions (
    -- Primary key
    id BIGSERIAL PRIMARY KEY,

    -- Foreign key (no actual FK constraint - different database)
    project_id VARCHAR(50) NOT NULL,

    -- Version identifier (e.g., "v1.0", "v2.0")
    version VARCHAR(20) NOT NULL,

    -- Snapshot data (immutable) - stores all text labels at publish time
    text_labels_snapshot JSONB NOT NULL,

    -- Metadata
    notes TEXT,  -- Optional publish notes
    published_by INTEGER NOT NULL,  -- References User DB user.id
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Computed fields (stored for query performance)
    label_count INTEGER NOT NULL DEFAULT 0,  -- Total labels in snapshot
    image_level_count INTEGER NOT NULL DEFAULT 0,  -- Image-level labels
    region_level_count INTEGER NOT NULL DEFAULT 0  -- Region-level labels
);

-- Create indexes
CREATE INDEX IF NOT EXISTS ix_text_label_versions_project_id ON text_label_versions(project_id);
CREATE INDEX IF NOT EXISTS ix_text_label_versions_created_at ON text_label_versions(created_at);
CREATE INDEX IF NOT EXISTS ix_text_label_versions_published_by ON text_label_versions(published_by);
CREATE INDEX IF NOT EXISTS ix_text_label_versions_project_created ON text_label_versions(project_id, created_at);

-- Unique constraint: one version per project
CREATE UNIQUE INDEX IF NOT EXISTS uq_text_label_versions_project_version ON text_label_versions(project_id, version);

-- Verify table creation
SELECT 'Table created successfully!' as status;
SELECT COUNT(*) as column_count FROM information_schema.columns WHERE table_name = 'text_label_versions';
