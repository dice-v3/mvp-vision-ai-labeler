# Deployment Guide

Complete guide for deploying Vision AI Labeler to production.

---

## 📋 Prerequisites

### Infrastructure Requirements

- **Compute**:
  - Backend: 2 CPU, 4GB RAM minimum
  - Frontend: 2 CPU, 4GB RAM minimum
- **Database**: PostgreSQL 14+ (3 instances)
- **Storage**: Cloudflare R2 or S3-compatible storage
- **Cache**: Redis 7+ (optional but recommended)

### Access Requirements

- **Platform Team**:
  - Platform Database credentials (read-only)
  - User Database credentials (read-only)
  - `SERVICE_JWT_SECRET` (must match Platform's secret)
- **Cloudflare R2**:
  - Account ID
  - Access Key ID
  - Secret Access Key
  - Bucket names

---

## 🚀 Fresh Production Deployment

### Step 1: Prepare Infrastructure

#### Option A: Using Docker Compose (Recommended for Development)

```bash
# Clone repository
git clone https://github.com/your-org/mvp-vision-ai-labeler.git
cd mvp-vision-ai-labeler

# Start all services
docker-compose up -d

# This starts:
# - Platform DB (port 5432)
# - User DB (port 5433)
# - Labeler DB (port 5435)
# - Redis (port 6379)
```

#### Option B: Managed Databases (Recommended for Production)

Use managed PostgreSQL services:
- **AWS RDS** / **Google Cloud SQL** / **Azure Database**
- Create 3 separate PostgreSQL instances:
  1. Platform DB (if not already managed by Platform team)
  2. User DB (if not already managed by Platform team)
  3. Labeler DB (your responsibility)

---

### Step 2: Configure Environment Variables

```bash
cd backend

# Copy template
cp .env.example .env

# Edit .env with production values
nano .env
```

#### Critical Variables to Update:

```bash
# ==========================================
# CRITICAL: Change these for production!
# ==========================================

# Database connections
PLATFORM_DB_HOST=<production-platform-db-host>
PLATFORM_DB_PASSWORD=<get-from-platform-team>

USER_DB_HOST=<production-user-db-host>
USER_DB_PASSWORD=<get-from-platform-team>

LABELER_DB_HOST=<production-labeler-db-host>
LABELER_DB_PASSWORD=<generate-strong-password>

# JWT Secrets
JWT_SECRET_KEY=<generate-strong-secret>
SERVICE_JWT_SECRET=<MUST-MATCH-PLATFORM>

# Cloudflare R2
S3_ENDPOINT=https://<YOUR_ACCOUNT_ID>.r2.cloudflarestorage.com
S3_ACCESS_KEY=<your-r2-access-key>
S3_SECRET_KEY=<your-r2-secret-key>

# CORS Origins
CORS_ORIGINS=https://your-production-domain.com

# Environment
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
```

#### Generate Strong Secrets:

```bash
# Generate JWT_SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(64))"

# SERVICE_JWT_SECRET must match Platform's secret!
# Get this from Platform team
```

---

### Step 3: Initialize Database

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Run database initialization
python scripts/init_database.py

# Expected output:
# ✓ Connection successful!
# ✓ Migrations completed successfully
# ✓ All expected tables exist
```

#### Verify Initialization:

```bash
# Check migration status
alembic current

# Should show: 20251130_1600 (add published_task_types to datasets table)
```

---

### Step 4: Test Backend

```bash
# Start backend server
uvicorn app.main:app --host 0.0.0.0 --port 8001

# Test API
curl http://localhost:8001/health
# Expected: {"status":"healthy"}

# Test API docs
# Open: http://localhost:8001/docs
```

---

### Step 5: Deploy Frontend

```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Start production server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start npm --name "labeler-frontend" -- start
```

---

### Step 6: Verify Integration

#### Test Service JWT:

```python
# scripts/test_service_jwt.py
import jwt
from datetime import datetime, timedelta
import requests

SERVICE_JWT_SECRET = "<YOUR_SERVICE_JWT_SECRET>"

# Generate token
token = jwt.encode({
    "sub": "1",
    "service": "platform",
    "scopes": ["labeler:read"],
    "type": "service",
    "iat": datetime.utcnow(),
    "exp": datetime.utcnow() + timedelta(minutes=5)
}, SERVICE_JWT_SECRET, algorithm="HS256")

# Test Platform API
response = requests.get(
    "http://localhost:8001/api/v1/platform/datasets",
    headers={"Authorization": f"Bearer {token}"}
)

print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
```

---

## 🔄 Updating Existing Deployment

### Step 1: Backup Database

```bash
# Backup Labeler DB
pg_dump -h <host> -U labeler_user labeler > labeler_backup_$(date +%Y%m%d).sql

# For Docker:
docker exec labeler-postgres-labeler pg_dump -U labeler_user labeler > labeler_backup_$(date +%Y%m%d).sql
```

### Step 2: Pull Latest Code

```bash
git fetch origin
git checkout main
git pull origin main
```

### Step 3: Update Dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt --upgrade

# Frontend
cd frontend
npm install
```

### Step 4: Run Migrations

```bash
cd backend

# Check current version
alembic current

# Upgrade to latest
alembic upgrade head

# Verify
alembic current
```

### Step 5: Restart Services

```bash
# Backend
pm2 restart labeler-backend

# Frontend
pm2 restart labeler-frontend

# Or if using Docker:
docker-compose restart
```

---

## 🔐 Security Checklist

### Environment Variables

- [ ] All passwords changed from default values
- [ ] `SERVICE_JWT_SECRET` matches Platform exactly
- [ ] `JWT_SECRET_KEY` is strong and unique
- [ ] Database passwords are strong (20+ characters)
- [ ] R2 credentials are production keys (not dev)

### Database

- [ ] Labeler DB has strong password
- [ ] Platform DB connection is read-only
- [ ] User DB connection is read-only
- [ ] Database connections use SSL (production)
- [ ] Regular backups configured

### API

- [ ] CORS origins restricted to production domains only
- [ ] `DEBUG=false` in production
- [ ] `ENVIRONMENT=production`
- [ ] Rate limiting configured (if applicable)

### Storage

- [ ] R2 buckets are production buckets
- [ ] Bucket permissions are restrictive
- [ ] Public access is disabled (unless needed)

---

## 📊 Monitoring

### Health Checks

```bash
# Backend health
curl https://your-domain.com/api/health

# Database connection
curl https://your-domain.com/api/health/database
```

### Logs

```bash
# Backend logs (PM2)
pm2 logs labeler-backend

# Frontend logs
pm2 logs labeler-frontend

# Database logs (Docker)
docker logs labeler-postgres-labeler
```

### Metrics to Monitor

- **Backend**:
  - Request latency (p50, p95, p99)
  - Error rate
  - Database connection pool usage
  - Memory usage
- **Frontend**:
  - Page load time
  - API call latency
  - Error rate
- **Database**:
  - Connection count
  - Query performance
  - Storage usage

---

## 🔧 Troubleshooting

### Database Connection Failed

```bash
# Test connection
psql -h <host> -U labeler_user -d labeler

# Check if database exists
psql -h <host> -U labeler_user -l

# Create database if missing
createdb -h <host> -U labeler_user labeler
```

### Migration Failed

```bash
# Check current version
alembic current

# Check migration history
alembic history

# Stamp database with specific version
alembic stamp <version>

# Try upgrade again
alembic upgrade head
```

### Service JWT Authentication Failed

```bash
# Verify secret matches Platform
echo "Labeler: $SERVICE_JWT_SECRET"
# Compare with Platform's SERVICE_JWT_SECRET

# Test JWT generation
python scripts/test_service_jwt.py

# Check logs
pm2 logs labeler-backend | grep "JWT"
```

### Storage Connection Failed

```bash
# Test R2 connection
python -c "
import boto3
client = boto3.client(
    's3',
    endpoint_url='https://<account>.r2.cloudflarestorage.com',
    aws_access_key_id='<key>',
    aws_secret_access_key='<secret>'
)
print(client.list_buckets())
"
```

---

## 📚 Additional Resources

- [README.md](../README.md) - Project overview
- [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md) - Architecture details
- [PLATFORM_ANNOTATION_FORMAT.md](./PLATFORM_ANNOTATION_FORMAT.md) - Integration guide
- [API Documentation](http://localhost:8001/docs) - Interactive API docs

---

## 🆘 Support

**Issues**: GitHub Issues
**Docs**: [./docs/](../docs/)
**Slack**: #labeler-backend

---

**Last Updated**: 2025-11-30
**Version**: 1.16.6
