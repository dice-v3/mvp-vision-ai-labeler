# Database Migration Guide

Guide for migrating from old database architecture (3 separate PostgreSQL containers) to new architecture (single PostgreSQL instance with 3 databases).

---

## 📊 Architecture Change Overview

### Old Architecture (Before 2025-12-09)

```
Labeler Docker Compose
├── postgres-platform (port 5432)  ← Platform DB
├── postgres-user (port 5433)      ← Users DB
└── postgres-labeler (port 5435)   ← Labeler DB
```

**Issues:**
- ❌ Resource inefficiency (3 PostgreSQL processes)
- ❌ Complex port management (3 different ports)
- ❌ Separate backup/restore processes
- ❌ Not following standard PostgreSQL practices

### New Architecture (After 2025-12-09)

```
Platform Docker Compose (mvp-vision-ai-platform/infrastructure)
└── PostgreSQL Instance (port 5432)
    ├── platform database (Platform team)
    ├── users database (Platform team, shared with Labeler)
    └── labeler database (Labeler team)
```

**Benefits:**
- ✅ Resource efficiency (1 PostgreSQL process)
- ✅ Simplified port management (single port 5432)
- ✅ Single backup/restore process
- ✅ Standard PostgreSQL practice
- ✅ Logical isolation (databases cannot query each other)

---

## 🔄 Migration Steps

### Step 1: Backup Existing Data

**CRITICAL: Do this before any changes!**

```bash
# Navigate to Labeler project
cd mvp-vision-ai-labeler

# Backup Labeler database (port 5435)
docker exec labeler-postgres-labeler pg_dump -U labeler_user labeler > backup_labeler_$(date +%Y%m%d).sql

# Optional: Backup Platform and Users databases if you manage them
docker exec labeler-postgres-platform pg_dump -U admin platform > backup_platform_$(date +%Y%m%d).sql
docker exec labeler-postgres-user pg_dump -U admin users > backup_users_$(date +%Y%m%d).sql

# Verify backups
ls -lh backup_*.sql
```

### Step 2: Stop Old Containers

```bash
cd mvp-vision-ai-labeler

# Stop all services
docker-compose down

# Optional: Remove volumes if you want clean slate (CAREFUL!)
# docker volume rm labeler_postgres_labeler_data
# docker volume rm labeler_postgres_platform_data
# docker volume rm labeler_postgres_user_data
```

### Step 3: Start Platform Infrastructure

```bash
# Navigate to Platform project
cd ../mvp-vision-ai-platform/infrastructure

# Pull latest changes
git pull origin develop

# Start Platform infrastructure (creates all 3 databases)
docker-compose up -d

# Wait for PostgreSQL to be healthy
docker logs platform-postgres -f
# Press Ctrl+C when you see "database system is ready to accept connections"

# Verify all databases exist
docker exec platform-postgres psql -U admin -c "\l"

# Expected output:
#   platform  | admin | UTF8
#   users     | admin | UTF8
#   labeler   | admin | UTF8
```

### Step 4: Update Labeler Configuration

```bash
cd ../mvp-vision-ai-labeler/backend

# Update .env file
nano .env  # or code .env
```

**Change these values:**

```bash
# Before (3 separate instances)
PLATFORM_DB_PORT=5432
USER_DB_PORT=5433
LABELER_DB_PORT=5435

# After (single instance)
PLATFORM_DB_PORT=5432
USER_DB_PORT=5432  # ← Changed
LABELER_DB_PORT=5432  # ← Changed

# Keep everything else the same
PLATFORM_DB_HOST=localhost
PLATFORM_DB_NAME=platform
PLATFORM_DB_USER=admin
PLATFORM_DB_PASSWORD=devpass

USER_DB_HOST=localhost
USER_DB_NAME=users
USER_DB_USER=admin
USER_DB_PASSWORD=devpass

LABELER_DB_HOST=localhost
LABELER_DB_NAME=labeler
LABELER_DB_USER=admin
LABELER_DB_PASSWORD=devpass
```

### Step 5: Restore Labeler Data

```bash
# Restore Labeler database to new instance
docker exec -i platform-postgres psql -U admin -d labeler < backup_labeler_$(date +%Y%m%d).sql

# Verify data
docker exec platform-postgres psql -U admin -d labeler -c "\dt"

# Check record counts
docker exec platform-postgres psql -U admin -d labeler -c "
SELECT 'datasets' as table_name, count(*) FROM datasets
UNION ALL
SELECT 'annotations', count(*) FROM annotations
UNION ALL
SELECT 'annotation_projects', count(*) FROM annotation_projects;
"
```

### Step 6: Initialize/Update Schema

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run schema initialization (or migrations)
python scripts/init_database.py

# Expected output:
# ✓ Connection successful!
# ⚠️  Database already has N tables (from restore)
# Continue anyway? (y/N): y
# ✓ Migrations completed successfully
# ✓ All expected tables exist
```

### Step 7: Verify Labeler Application

```bash
# Start backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# Test in another terminal
curl http://localhost:8001/health
# Expected: {"status":"healthy"}

# Test database connection
curl http://localhost:8001/api/health/database
# Expected: {"status":"healthy","database":"connected"}

# Test API docs
# Open: http://localhost:8001/docs
```

### Step 8: Update Docker Compose (Optional)

The Labeler's `docker-compose.yml` has been updated to only run Redis.

```bash
cd mvp-vision-ai-labeler

# Start Redis only (PostgreSQL is managed by Platform)
docker-compose up -d redis

# Verify Redis
docker exec labeler-redis redis-cli ping
# Expected: PONG
```

---

## ✅ Verification Checklist

After migration, verify:

- [ ] **PostgreSQL Instance**
  - [ ] Platform's PostgreSQL container is running
  - [ ] Container name: `platform-postgres`
  - [ ] Port: `5432`
  - [ ] All 3 databases exist: platform, users, labeler

- [ ] **Labeler Database**
  - [ ] Database exists: `docker exec platform-postgres psql -U admin -c "\l" | grep labeler`
  - [ ] Tables exist: `docker exec platform-postgres psql -U admin -d labeler -c "\dt"`
  - [ ] Data restored: Check record counts match backup

- [ ] **Configuration**
  - [ ] `.env` updated with port 5432 for all databases
  - [ ] Backend can connect to all 3 databases
  - [ ] No connection errors in logs

- [ ] **Application**
  - [ ] Backend starts without errors
  - [ ] Health endpoint responds: `curl http://localhost:8001/health`
  - [ ] API docs accessible: `http://localhost:8001/docs`
  - [ ] Can create/read datasets and annotations

- [ ] **Cleanup**
  - [ ] Old database containers stopped
  - [ ] Old database volumes removed (optional)
  - [ ] Backups stored safely

---

## 🚨 Troubleshooting

### Problem: "Database 'labeler' does not exist"

**Solution:**

```bash
# Create database manually
docker exec platform-postgres psql -U admin -c "CREATE DATABASE labeler;"

# Grant permissions
docker exec platform-postgres psql -U admin -c "GRANT ALL PRIVILEGES ON DATABASE labeler TO admin;"
```

### Problem: "Connection refused" on port 5432

**Solution:**

```bash
# Check if Platform's PostgreSQL is running
docker ps | grep platform-postgres

# If not running, start Platform infrastructure
cd ../mvp-vision-ai-platform/infrastructure
docker-compose up -d

# Check logs
docker logs platform-postgres
```

### Problem: "Too many connections"

**Solution:**

```bash
# Check active connections
docker exec platform-postgres psql -U admin -c "
SELECT datname, count(*) as connections
FROM pg_stat_activity
GROUP BY datname;
"

# Increase max_connections (if needed)
docker exec platform-postgres psql -U admin -c "ALTER SYSTEM SET max_connections = 200;"
docker restart platform-postgres
```

### Problem: "Permission denied for database labeler"

**Solution:**

```bash
# Grant all privileges to admin user
docker exec platform-postgres psql -U admin -c "
GRANT ALL PRIVILEGES ON DATABASE labeler TO admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;
"

# Switch to labeler database and grant permissions
docker exec platform-postgres psql -U admin -d labeler -c "
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
"
```

### Problem: Migration fails with "alembic_version does not exist"

**Solution:**

```bash
# If you restored from backup and alembic table is missing
cd backend

# Check current schema version in backup
grep -A 5 "alembic_version" backup_labeler_*.sql

# Stamp database with current version
alembic stamp head

# Or run migrations from scratch
python scripts/init_database.py
```

---

## 📝 Production Migration

For production environments (AWS RDS, etc.):

### Step 1: Coordinate with Platform Team

```bash
# Platform team should:
# 1. Create RDS PostgreSQL instance
# 2. Create databases: platform, users, labeler
# 3. Provide connection credentials
# 4. Grant Labeler team access to 'labeler' database
```

### Step 2: Update Production .env

```bash
# Production database configuration
PLATFORM_DB_HOST=vision-platform-prod.xxxxx.rds.amazonaws.com
PLATFORM_DB_PORT=5432
PLATFORM_DB_NAME=platform
PLATFORM_DB_USER=platform_readonly
PLATFORM_DB_PASSWORD=<get-from-platform-team>

USER_DB_HOST=vision-platform-prod.xxxxx.rds.amazonaws.com
USER_DB_PORT=5432
USER_DB_NAME=users
USER_DB_USER=users_readonly
USER_DB_PASSWORD=<get-from-platform-team>

LABELER_DB_HOST=vision-platform-prod.xxxxx.rds.amazonaws.com
LABELER_DB_PORT=5432
LABELER_DB_NAME=labeler
LABELER_DB_USER=labeler_user
LABELER_DB_PASSWORD=<secure-password>

# All use same host and port!
```

### Step 3: Backup Production Data

```bash
# From old production instance
pg_dump -h <old-host> -U labeler_user -d labeler > prod_backup_labeler.sql

# Upload to S3 for safety
aws s3 cp prod_backup_labeler.sql s3://vision-backups/labeler/$(date +%Y%m%d)/
```

### Step 4: Restore to New Instance

```bash
# Restore to new RDS instance
psql -h vision-platform-prod.xxxxx.rds.amazonaws.com \
     -U labeler_user \
     -d labeler \
     < prod_backup_labeler.sql

# Verify
psql -h vision-platform-prod.xxxxx.rds.amazonaws.com -U labeler_user -d labeler -c "\dt"
```

### Step 5: Run Migrations

```bash
# On production server
cd backend
python scripts/init_database.py

# Or using Alembic directly
alembic upgrade head
```

---

## 📚 References

- **Platform Database Management**: `../mvp-vision-ai-platform/docs/infrastructure/DATABASE_MANAGEMENT.md`
- **Labeler Deployment Guide**: `./DEPLOYMENT_GUIDE.md`
- **Environment Configuration**: `../backend/.env.example`

---

## 🆘 Support

If you encounter issues during migration:

1. **Check Logs**: `docker logs platform-postgres`
2. **Verify Backups**: Ensure backups exist before proceeding
3. **Test Connection**: Use `psql` to manually connect
4. **Contact Platform Team**: For database infrastructure issues

---

**Migration Prepared**: 2025-12-09
**Tested**: Local development environment
**Status**: Ready for production

