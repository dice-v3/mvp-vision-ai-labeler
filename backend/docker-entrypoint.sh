#!/bin/bash
set -e

echo "=================================================="
echo "Vision AI Labeler - Backend Startup"
echo "=================================================="

# Wait for database to be ready
if [ "$WAIT_FOR_DB" = "true" ]; then
    echo "[INFO] Waiting for database to be ready..."
    uv run python init_labeler_db.py --wait --skip-migration
fi

# Run migrations if enabled
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "[INFO] Running database migrations..."
    uv run python init_labeler_db.py --create-db
fi

# Start the application
echo "[INFO] Starting uvicorn server..."
exec uv run uvicorn app.main:app --host ${API_HOST:-0.0.0.0} --port ${API_PORT:-8001}
