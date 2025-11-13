@echo off
echo ===================================
echo Vision AI Labeler Infrastructure
echo ===================================
echo.

echo Stopping Labeler Infrastructure...
echo.

REM Stop Labeler PostgreSQL
docker-compose down
if %errorlevel% equ 0 (
    echo   [OK] Labeler infrastructure stopped
) else (
    echo   [WARN] Some containers may not have stopped properly
)

echo.
echo ===================================
echo Infrastructure Stopped!
echo ===================================
echo.
echo Note: Backend and Frontend servers are NOT stopped.
echo Stop them manually if needed (Ctrl+C in their terminals).
echo.
pause
