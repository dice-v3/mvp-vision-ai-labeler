# Vision AI Labeler - Setup Guide

## Prerequisites

Before starting the Labeler, make sure the Platform infrastructure is running:

### Platform Services (Required)
- **PostgreSQL**: `localhost:5432` (Platform DB)
- **MinIO**: `localhost:9000-9001` (S3-compatible storage)
- **Redis**: `localhost:6379` (Cache)

Start Platform services from the `mvp-vision-ai-platform` directory.

## Quick Start

### Step 1: Start Infrastructure

**Windows:**
```bash
start.bat
```

This script will:
- ✅ Check if Platform infrastructure is running (PostgreSQL, MinIO, Redis)
- ✅ Start Labeler PostgreSQL (port 5435)

**Linux/Mac:**
```bash
docker-compose up -d
```

### Step 2: Start Backend (Terminal 1)

```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8010
```

### Step 3: Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

### Step 4: Access the Application

- Frontend: http://localhost:3010
- Backend API: http://localhost:8010
- API Docs: http://localhost:8010/docs

### Stop Infrastructure

**Windows:**
```bash
stop.bat
```

**Linux/Mac:**
```bash
docker-compose down
```

**Note:** Stop backend and frontend manually (Ctrl+C in their terminals)

## Architecture

### Port Configuration
- **Platform PostgreSQL**: 5432 (read-only access)
- **Platform MinIO**: 9000-9001 (image storage)
- **Platform Redis**: 6379 (cache)
- **Labeler PostgreSQL**: 5435 (annotation data)
- **Backend API**: 8010
- **Frontend**: 3010

### Service Dependencies
```
Labeler Frontend (3010)
    ↓
Labeler Backend (8010)
    ↓
├─ Platform PostgreSQL (5432) - Datasets
├─ Labeler PostgreSQL (5435)  - Annotations
└─ Platform MinIO (9000)       - Images
```

## Troubleshooting

### Platform services not running
**Error:** `Platform PostgreSQL is NOT running on port 5432`

**Solution:** Start Platform infrastructure first:
```bash
cd ../mvp-vision-ai-platform
docker-compose up -d
```

### Port already in use
**Error:** `EADDRINUSE: address already in use`

**Solution:** Stop conflicting processes:
```bash
stop.bat
# Wait a few seconds, then
start.bat
```

### Database connection failed
**Error:** `Connection refused to PostgreSQL`

**Solution:** Ensure Docker containers are running:
```bash
docker ps
```

You should see:
- `labeler-postgres-labeler` (port 5435)
- `platform-postgres` (port 5432)
- `platform-minio-tier0` (port 9000-9001)

### Images not loading
**Error:** Images fail to load with 403 Forbidden

**Solution:**
1. Check MinIO is running: `docker ps | findstr minio`
2. Verify backend uses correct MinIO credentials in `.env`
3. Restart backend: Close terminal and run `start.bat` again

## Development

### Backend Hot Reload
Backend automatically reloads when code changes are detected.

### Frontend Hot Reload
Frontend automatically reloads when code changes are saved.

### Database Migrations
```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Configuration Files

- `backend/.env` - Backend configuration (DB, MinIO, Redis)
- `frontend/.env.local` - Frontend configuration (API URL)
- `docker-compose.yml` - Labeler infrastructure
