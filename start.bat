@echo off
echo ===================================
echo Vision AI Labeler Infrastructure
echo ===================================
echo.

REM Check Platform Infrastructure
echo [1/2] Checking Platform Infrastructure...
echo.

REM Check Platform PostgreSQL (port 5432)
netstat -an | findstr ":5432" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo   [OK] Platform PostgreSQL is running on port 5432
) else (
    echo   [ERROR] Platform PostgreSQL is NOT running on port 5432
    echo   Please start Platform infrastructure first!
    pause
    exit /b 1
)

REM Check Platform MinIO (port 9000)
netstat -an | findstr ":9000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo   [OK] Platform MinIO is running on port 9000
) else (
    echo   [ERROR] Platform MinIO is NOT running on port 9000
    echo   Please start Platform infrastructure first!
    pause
    exit /b 1
)

REM Check Platform Redis (port 6379)
netstat -an | findstr ":6379" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo   [OK] Platform Redis is running on port 6379
) else (
    echo   [ERROR] Platform Redis is NOT running on port 6379
    echo   Please start Platform infrastructure first!
    pause
    exit /b 1
)

echo.
echo [2/2] Starting Labeler Infrastructure...
echo.

REM Start Labeler PostgreSQL
docker-compose up -d postgres-labeler
if %errorlevel% equ 0 (
    echo   [OK] Labeler PostgreSQL started on port 5435
) else (
    echo   [ERROR] Failed to start Labeler PostgreSQL
    pause
    exit /b 1
)

REM Wait for database to be ready
echo   Waiting for database to be ready...
timeout /t 3 /nobreak >nul

echo.
echo ===================================
echo Infrastructure Ready!
echo ===================================
echo.
echo Platform Services:
echo   - PostgreSQL: localhost:5432
echo   - MinIO:      localhost:9000
echo   - Redis:      localhost:6379
echo.
echo Labeler Services:
echo   - PostgreSQL: localhost:5435
echo.
echo Next Steps:
echo   1. Start Backend:  cd backend ^&^& python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8010
echo   2. Start Frontend: cd frontend ^&^& npm run dev
echo.
pause
