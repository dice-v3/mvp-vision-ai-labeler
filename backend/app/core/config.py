"""
Application Configuration

Manages environment variables and application settings.
"""

from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "Vision AI Labeler API"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8001
    API_RELOAD: bool = True
    API_WORKERS: int = 1

    # CORS
    CORS_ORIGINS: Union[List[str], str] = "http://localhost:3001,http://localhost:3000,http://localhost:3010"

    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v

    # Frontend URL (for SSO redirect - Phase 17)
    FRONTEND_URL: str = "http://localhost:3010"

    # Platform Database (Read-Only)
    PLATFORM_DB_HOST: str = "localhost"
    PLATFORM_DB_PORT: int = 5432
    PLATFORM_DB_NAME: str = "platform"
    PLATFORM_DB_USER: str = "labeler_readonly"
    PLATFORM_DB_PASSWORD: str = "labeler_readonly_password"

    @property
    def PLATFORM_DB_URL(self) -> str:
        """Construct Platform database URL."""
        return (
            f"postgresql://{self.PLATFORM_DB_USER}:{self.PLATFORM_DB_PASSWORD}"
            f"@{self.PLATFORM_DB_HOST}:{self.PLATFORM_DB_PORT}/{self.PLATFORM_DB_NAME}"
        )

    # Labeler Database (Full Access)
    # Updated 2025-12-09: Single PostgreSQL instance architecture
    # Platform team manages PostgreSQL instance, Labeler team manages schema only
    LABELER_DB_HOST: str = "localhost"
    LABELER_DB_PORT: int = 5432
    LABELER_DB_NAME: str = "labeler"
    LABELER_DB_USER: str = "admin"
    LABELER_DB_PASSWORD: str = "devpass"

    @property
    def LABELER_DB_URL(self) -> str:
        """Construct Labeler database URL."""
        return (
            f"postgresql://{self.LABELER_DB_USER}:{self.LABELER_DB_PASSWORD}"
            f"@{self.LABELER_DB_HOST}:{self.LABELER_DB_PORT}/{self.LABELER_DB_NAME}"
        )

    # S3 / MinIO / R2
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET_DATASETS: str = "datasets"
    S3_BUCKET_ANNOTATIONS: str = "annotations"
    S3_REGION: str = "us-east-1"
    S3_USE_SSL: bool = False

    # R2 Public Development URL (Phase 9.3)
    # When set, use this for public image URLs instead of presigned URLs
    R2_PUBLIC_URL: str = ""

    # Keycloak Authentication
    KEYCLOAK_SERVER_URL: str = "http://localhost:8080"
    KEYCLOAK_REALM: str = "mvp-vision"
    KEYCLOAK_CLIENT_ID: str = "labeler-backend"
    KEYCLOAK_CLIENT_SECRET: str = "your-client-secret"
    KEYCLOAK_VERIFY_SSL: bool = True  # Set to False for self-signed certs in development

    # Service JWT Authentication (Phase 16.5 - Platform Integration)
    # Shared secret for verifying JWTs from Platform service
    SERVICE_JWT_SECRET: str = "service-jwt-secret-change-in-production"
    SERVICE_JWT_ALGORITHM: str = "HS256"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields from .env (like NEXT_PUBLIC_*)


# Global settings instance
settings = Settings()
