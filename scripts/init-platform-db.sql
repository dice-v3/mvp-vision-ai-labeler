-- Platform Database Initialization Script
-- This simulates the Platform's database schema for development

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    badge_color VARCHAR(7) DEFAULT '#9333ea',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create datasets table
CREATE TABLE IF NOT EXISTS datasets (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    format VARCHAR(50) NOT NULL,
    source VARCHAR(50) DEFAULT 'upload',
    visibility VARCHAR(20) DEFAULT 'private',
    labeled BOOLEAN DEFAULT FALSE,
    num_items INTEGER DEFAULT 0,
    size_mb DECIMAL(10, 2),
    storage_path TEXT,
    tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create snapshots table (for training integration)
CREATE TABLE IF NOT EXISTS snapshots (
    id VARCHAR(50) PRIMARY KEY,
    dataset_id VARCHAR(50) REFERENCES datasets(id),
    snapshot_type VARCHAR(50) NOT NULL,
    storage_path TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_datasets_owner_id ON datasets(owner_id);
CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON datasets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_dataset_id ON snapshots(dataset_id);

-- Insert test users
-- Password: 'admin123' (bcrypt hash)
INSERT INTO users (email, username, password_hash, full_name, is_active, is_admin, badge_color)
VALUES
    ('admin@example.com', 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIq8E4O8p6', '관리자', TRUE, TRUE, '#9333ea'),
    ('user@example.com', 'user', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIq8E4O8p6', '사용자', TRUE, FALSE, '#3b82f6')
ON CONFLICT (email) DO NOTHING;

-- Insert test datasets
INSERT INTO datasets (id, name, description, owner_id, format, source, visibility, labeled, num_items, size_mb, storage_path, tags)
VALUES
    ('ds_test_001', 'COCO 2017 Sample', 'Sample dataset from COCO 2017 validation set', 1, 'coco', 'download', 'public', TRUE, 500, 125.5, 'datasets/ds_test_001/', ARRAY['object-detection', 'coco', 'sample']),
    ('ds_test_002', 'ImageNet Sample', 'Sample classification dataset', 1, 'imagefolder', 'upload', 'private', FALSE, 1000, 250.0, 'datasets/ds_test_002/', ARRAY['classification', 'imagenet']),
    ('ds_test_003', 'Custom Annotations', 'User uploaded custom dataset', 2, 'yolo', 'upload', 'private', FALSE, 200, 45.3, 'datasets/ds_test_003/', ARRAY['custom', 'yolo'])
ON CONFLICT (id) DO NOTHING;

-- Create read-only user for Labeler (development only)
-- In production, use PostgreSQL replication instead
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'labeler_readonly') THEN
        CREATE USER labeler_readonly WITH PASSWORD 'labeler_readonly_password';
        GRANT CONNECT ON DATABASE platform TO labeler_readonly;
        GRANT USAGE ON SCHEMA public TO labeler_readonly;
        GRANT SELECT ON users, datasets, snapshots TO labeler_readonly;
    END IF;
END
$$;

-- Add comments
COMMENT ON TABLE users IS 'Platform users (managed by Platform)';
COMMENT ON TABLE datasets IS 'Datasets uploaded to Platform (managed by Platform)';
COMMENT ON TABLE snapshots IS 'Annotation snapshots for training (created by Labeler)';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Platform database initialized successfully';
    RAISE NOTICE 'Test users: admin@example.com / user@example.com (password: admin123)';
    RAISE NOTICE 'Test datasets: 3 datasets created';
END
$$;
