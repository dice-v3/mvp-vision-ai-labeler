# Backend Dockerfile for Vision AI Labeler
# Multi-stage build with uv for fast package installation

ARG REGISTRY_MIRROR=""
ARG UV_IMAGE="ghcr.io/astral-sh/uv:latest"

# UV image stage (for registry mirror support)
FROM ${UV_IMAGE} AS uv

# Stage 1: Builder
FROM ${REGISTRY_MIRROR}python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=uv /uv /usr/local/bin/uv

# Copy dependency files first for caching
COPY pyproject.toml uv.lock* ./

# Install dependencies using uv
RUN --mount=type=cache,target=/root/.cache/uv \
    uv venv /opt/venv && \
    . /opt/venv/bin/activate && \
    if [ -f uv.lock ]; then \
        uv sync --frozen --no-dev; \
    elif [ -f requirements.txt ]; then \
        uv pip install -r requirements.txt; \
    else \
        uv sync --no-dev; \
    fi

# Stage 2: Runner
FROM ${REGISTRY_MIRROR}python:3.11-slim AS runner

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    WAIT_FOR_DB=false \
    RUN_MIGRATIONS=false

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy uv from uv stage
COPY --from=uv /uv /usr/local/bin/uv

# Copy virtual env from builder
COPY --from=builder /opt/venv /opt/venv

# Copy application code
COPY . .

# Make entrypoint script executable
RUN chmod +x docker-entrypoint.sh

# Create non-root user for security
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run the application
ENTRYPOINT ["./docker-entrypoint.sh"]
