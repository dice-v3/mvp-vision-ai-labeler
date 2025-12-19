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
    LABELER_DB_HOST: str = "localhost"
    LABELER_DB_PORT: int = 5433
    LABELER_DB_NAME: str = "labeler"
    LABELER_DB_USER: str = "labeler_user"
    LABELER_DB_PASSWORD: str = "labeler_password"

    @property
    def LABELER_DB_URL(self) -> str:
        """Construct Labeler database URL."""
        return (
            f"postgresql://{self.LABELER_DB_USER}:{self.LABELER_DB_PASSWORD}"
            f"@{self.LABELER_DB_HOST}:{self.LABELER_DB_PORT}/{self.LABELER_DB_NAME}"
        )

    # Database Pool Settings (Phase 9 - for Railway deployment)
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 3600  # 1 hour

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""

    @property
    def REDIS_URL(self) -> str:
        """Construct Redis URL."""
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

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
