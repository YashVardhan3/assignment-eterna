@echo off
REM DEX Order Execution Engine - Setup Script (Windows)
REM This script sets up the development environment

echo ==================================
echo DEX Order Engine - Setup Script
echo ==================================
echo.

REM Check if Node.js is installed
echo Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed
    echo Please install Node.js 18+ from https://nodejs.org
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% found
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo [OK] npm %NPM_VERSION% found
echo.

REM Check if Redis is available
echo Checking Redis installation...
where redis-server >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Redis is not installed
    echo Install Redis:
    echo   - Download from: https://github.com/microsoftarchive/redis/releases
    echo   - Or use Docker: docker run -d -p 6379:6379 redis:7-alpine
    echo.
) else (
    echo [OK] Redis found
)

REM Check if PostgreSQL is available
echo Checking PostgreSQL installation...
where psql >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] PostgreSQL is not installed
    echo Install PostgreSQL:
    echo   - Download from: https://www.postgresql.org/download/windows/
    echo   - Or use Docker: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15-alpine
    echo.
) else (
    echo [OK] PostgreSQL found
)

echo ==================================
echo Installing Dependencies
echo ==================================
echo.

call npm install

if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)

echo.
echo [OK] Dependencies installed
echo.

REM Create .env file if it doesn't exist
if not exist .env (
    echo ==================================
    echo Creating .env file
    echo ==================================
    echo.
    copy .env.example .env
    echo [OK] .env file created
    echo [WARNING] Please update .env with your configuration
) else (
    echo [WARNING] .env file already exists
)

echo.
echo ==================================
echo Database Setup
echo ==================================
echo.

REM Check if database can be created
where psql >nul 2>nul
if %errorlevel% equ 0 (
    echo Creating database if not exists...
    createdb dex_orders 2>nul || echo Database already exists
    
    echo Running migrations...
    call npm run db:migrate || echo [WARNING] Migration failed - make sure PostgreSQL is running
) else (
    echo [WARNING] Skipping database creation - PostgreSQL not found
)

echo.
echo ==================================
echo Setup Complete!
echo ==================================
echo.
echo [OK] Next steps:
echo.
echo 1. Start Redis if not using Docker:
echo    redis-server
echo.
echo 2. Start PostgreSQL if not using Docker:
echo    net start postgresql-x64-15
echo.
echo 3. Update .env file with your configuration
echo.
echo 4. Start the development server:
echo    npm run dev
echo.
echo 5. Run tests:
echo    npm test
echo.
echo 6. Test with WebSocket client:
echo    npm run test:client
echo.
echo 7. Or use Docker Compose:
echo    docker-compose up -d
echo.
echo [OK] Access the application at: http://localhost:3000
echo [OK] Health check: http://localhost:3000/health
echo [OK] Demo UI: Open demo.html in your browser
echo.

pause
