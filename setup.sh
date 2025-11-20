#!/bin/bash

# DEX Order Execution Engine - Setup Script
# This script sets up the development environment

set -e

echo "=================================="
echo "DEX Order Engine - Setup Script"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js ${NODE_VERSION} found${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}✅ npm ${NPM_VERSION} found${NC}"
echo ""

# Check if Redis is installed
echo "Checking Redis installation..."
if ! command -v redis-server &> /dev/null; then
    echo -e "${YELLOW}⚠️  Redis is not installed${NC}"
    echo "Install Redis:"
    echo "  macOS: brew install redis"
    echo "  Ubuntu: sudo apt-get install redis-server"
    echo "  Or use Docker: docker run -d -p 6379:6379 redis:7-alpine"
    echo ""
else
    REDIS_VERSION=$(redis-server --version | head -n 1)
    echo -e "${GREEN}✅ ${REDIS_VERSION} found${NC}"
fi

# Check if PostgreSQL is installed
echo "Checking PostgreSQL installation..."
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL is not installed${NC}"
    echo "Install PostgreSQL:"
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu: sudo apt-get install postgresql"
    echo "  Or use Docker: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15-alpine"
    echo ""
else
    PSQL_VERSION=$(psql --version)
    echo -e "${GREEN}✅ ${PSQL_VERSION} found${NC}"
fi

echo ""
echo "=================================="
echo "Installing Dependencies"
echo "=================================="

npm install

echo ""
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "=================================="
    echo "Creating .env file"
    echo "=================================="
    cp .env.example .env
    echo -e "${GREEN}✅ .env file created${NC}"
    echo -e "${YELLOW}⚠️  Please update .env with your configuration${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠️  .env file already exists${NC}"
fi

echo ""
echo "=================================="
echo "Database Setup"
echo "=================================="

# Check if database exists
if command -v psql &> /dev/null; then
    echo "Creating database (if not exists)..."
    createdb dex_orders 2>/dev/null || echo "Database already exists"
    
    echo "Running migrations..."
    npm run db:migrate || echo -e "${YELLOW}⚠️  Migration failed - make sure PostgreSQL is running${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping database creation - PostgreSQL not found${NC}"
fi

echo ""
echo "=================================="
echo "Setup Complete!"
echo "=================================="
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo ""
echo "1. Start Redis (if not using Docker):"
echo "   redis-server"
echo ""
echo "2. Start PostgreSQL (if not using Docker):"
echo "   # macOS: brew services start postgresql"
echo "   # Ubuntu: sudo service postgresql start"
echo ""
echo "3. Update .env file with your configuration"
echo ""
echo "4. Start the development server:"
echo "   npm run dev"
echo ""
echo "5. Run tests:"
echo "   npm test"
echo ""
echo "6. Test with WebSocket client:"
echo "   npm run test:client"
echo ""
echo "7. Or use Docker Compose:"
echo "   docker-compose up -d"
echo ""
echo -e "${GREEN}Access the application at: http://localhost:3000${NC}"
echo -e "${GREEN}Health check: http://localhost:3000/health${NC}"
echo -e "${GREEN}Demo UI: Open demo.html in your browser${NC}"
echo ""
