# Development Guide

## 🚀 Quick Start

### Prerequisites

- Docker Desktop (Windows) or Docker + Docker Compose (Linux/Mac)
- Node.js 18+ (for frontend development)
- Python 3.11+ (for backend development)
- Git

### 1. Clone Repository

```bash
git clone https://github.com/yourorg/mvp-vision-ai-labeler.git
cd mvp-vision-ai-labeler
```

### 2. Setup Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Edit .env file and update values if needed
# Default values work for local development
```

### 3. Start Infrastructure

```bash
# Start all services (PostgreSQL x2, Redis, MinIO)
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f
```

**Services will be available at**:
- PostgreSQL Platform DB: `localhost:5432`
- PostgreSQL Labeler DB: `localhost:5433`
- Redis: `localhost:6379`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001` (minioadmin / minioadmin)

### 4. Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8001
```

Backend API will be available at: `http://localhost:8001`
- API Docs: `http://localhost:8001/docs`
- Redoc: `http://localhost:8001/redoc`

### 5. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be available at: `http://localhost:3001`

---

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app tests/

# Run specific test file
pytest tests/unit/test_auth.py

# Run with verbose output
pytest -v
```

### Frontend Tests

```bash
cd frontend

# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm test -- --watch
```

---

## 🗄️ Database Management

### View Database Contents

**Platform DB**:
```bash
docker exec -it labeler-postgres-platform psql -U platform_user -d platform

# List tables
\dt

# View users
SELECT * FROM users;

# View datasets
SELECT * FROM datasets;

# Exit
\q
```

**Labeler DB**:
```bash
docker exec -it labeler-postgres-labeler psql -U labeler_user -d labeler

# List tables
\dt

# Exit
\q
```

### Create Database Migration

```bash
cd backend

# Generate migration from model changes
alembic revision --autogenerate -m "Description of changes"

# Review generated migration file in alembic/versions/

# Apply migration
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Reset Database

```bash
# Stop containers
docker-compose down

# Remove volumes (WARNING: This deletes all data)
docker-compose down -v

# Start fresh
docker-compose up -d
```

---

## 🪣 MinIO Management

### Access MinIO Console

1. Open `http://localhost:9001`
2. Login: `minioadmin` / `minioadmin`
3. Buckets are automatically created:
   - `datasets`: For dataset images
   - `annotations`: For annotation data

### Upload Test Images (via CLI)

```bash
# Install MinIO client
# Windows: Download from https://min.io/download
# Linux/Mac: brew install minio/stable/mc

# Configure alias
mc alias set local http://localhost:9000 minioadmin minioadmin

# Upload files
mc cp my-image.jpg local/datasets/ds_test_001/

# List files
mc ls local/datasets/ds_test_001/
```

---

## 🔧 Common Commands

### Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart a service
docker-compose restart postgres-labeler

# View logs
docker-compose logs -f [service-name]

# Rebuild containers
docker-compose up -d --build

# Remove all containers and volumes
docker-compose down -v
```

### Backend Commands

```bash
# Format code
black app/
isort app/

# Lint code
flake8 app/
pylint app/

# Type checking
mypy app/

# Run development server with auto-reload
uvicorn app.main:app --reload --port 8001

# Run production server
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Frontend Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Format code
npm run format
```

---

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find process using port
# Windows:
netstat -ano | findstr :5432

# Kill process
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:5432 | xargs kill -9
```

### Docker Containers Won't Start

```bash
# Check Docker logs
docker-compose logs

# Remove old containers
docker-compose down
docker system prune -a

# Start fresh
docker-compose up -d
```

### Database Connection Error

1. Check if PostgreSQL containers are running:
   ```bash
   docker-compose ps
   ```

2. Check connection details in `.env` file

3. Test connection:
   ```bash
   docker exec -it labeler-postgres-labeler psql -U labeler_user -d labeler -c "SELECT 1;"
   ```

### MinIO Not Accessible

1. Check if MinIO container is healthy:
   ```bash
   docker-compose ps minio
   ```

2. Check MinIO logs:
   ```bash
   docker-compose logs minio
   ```

3. Access MinIO console: `http://localhost:9001`

---

## 📦 Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.

---

## 🤝 Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Write tests
4. Run linters and tests
5. Create a pull request to `develop`

---

## 📝 Additional Resources

- [API Documentation](./docs/design/API_SPEC.md)
- [Database Schema](./docs/design/DATABASE_SCHEMA.md)
- [Design System](./docs/design/DESIGN_SYSTEM.md)
- [Implementation Guide](./docs/design/IMPLEMENTATION_GUIDE.md)
