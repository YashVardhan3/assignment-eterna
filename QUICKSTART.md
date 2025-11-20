# Quick Start Guide

Get the DEX Order Execution Engine running in under 5 minutes!

## 🚀 Fast Track (Using Docker)

**Prerequisites:** Docker and Docker Compose installed

```bash
# 1. Clone repository
git clone <repository-url>
cd assignment-eterna

# 2. Start all services
docker-compose up -d

# 3. Wait for services to be ready (~30 seconds)
docker-compose logs -f app

# 4. Test the API
curl http://localhost:3000/health
```

✅ **Done!** API is running at `http://localhost:3000`

---

## 💻 Local Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Quick Setup

**Windows:**
```cmd
setup.bat
npm run dev
```

**macOS/Linux:**
```bash
chmod +x setup.sh
./setup.sh
npm run dev
```

### Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Create database
createdb dex_orders

# 4. Run migrations
npm run db:migrate

# 5. Start development server
npm run dev
```

---

## 🧪 Testing the API

### Option 1: WebSocket Test Client (Recommended)

```bash
# Single order test
npm run test:client

# Concurrent orders test (5 orders)
npm run test:concurrent
```

### Option 2: Browser Demo

Open `demo.html` in your browser and submit orders through the UI.

### Option 3: cURL + WebSocket Client

**Create Order:**
```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "market",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": 100,
    "slippage": 0.01,
    "walletAddress": "TestWallet"
  }'
```

**Connect WebSocket (JavaScript):**
```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/execute/ORDER_ID');
ws.onmessage = (event) => console.log(JSON.parse(event.data));
```

### Option 4: Postman Collection

1. Import `postman_collection.json` into Postman
2. Run "Create Market Order" request
3. Copy the `orderId` from response
4. Use Postman WebSocket feature to connect to:
   ```
   ws://localhost:3000/api/orders/execute/{orderId}
   ```

---

## 📊 Observing DEX Routing

Watch the console logs to see routing decisions:

```bash
# Terminal output shows:
Order abc123: Best quote from meteora
  Price: 1.02
  Amount Out: 101.8
  Fee: 0.2
  Net: 101.3 (after gas)
```

WebSocket messages include full quote comparison:
```json
{
  "quotes": [
    {"dex": "raydium", "amountOut": 99.7},
    {"dex": "meteora", "amountOut": 101.8}
  ],
  "selectedQuote": {"dex": "meteora"}
}
```

---

## 🔧 Common Issues

### Redis Connection Error
```bash
# Start Redis
redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### PostgreSQL Connection Error
```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL (macOS)
brew services start postgresql

# Start PostgreSQL (Ubuntu)
sudo service postgresql start
```

### Port Already in Use
```bash
# Change port in .env
PORT=3001
```

---

## 🎯 Next Steps

1. **Run Unit Tests:** `npm test`
2. **Check Coverage:** `npm test -- --coverage`
3. **Submit Concurrent Orders:** `npm run test:concurrent`
4. **Deploy to Production:** See `DEPLOYMENT.md`

---

## 📚 Documentation

- **Full Documentation:** `README.md`
- **Deployment Guide:** `DEPLOYMENT.md`
- **API Endpoints:** See README.md → API Documentation section

---

## 🆘 Need Help?

- Check logs: `docker-compose logs -f` (Docker) or console output (local)
- Health check: `curl http://localhost:3000/health`
- Run tests: `npm test`
- View demo: Open `demo.html` in browser

**Common URLs:**
- Health Check: http://localhost:3000/health
- Create Order: POST http://localhost:3000/api/orders/execute
- WebSocket: ws://localhost:3000/api/orders/execute/{orderId}
