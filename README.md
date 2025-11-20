# DEX Order Execution Engine

A high-performance backend for executing DEX orders on Solana, featuring smart routing between Raydium and Meteora, real-time WebSocket updates, and robust queue management.

## 🚀 Features

- **Smart DEX Routing**: Automatically finds the best price between Raydium and Meteora.
- **Real-time Updates**: WebSocket streaming of order status (Pending -> Routing -> Submitted -> Confirmed).
- **Market Orders**: Immediate execution at the best available price.
- **Concurrent Processing**: Handles high load (100+ orders/min) using BullMQ and Redis.
- **Rate Limiting**: Protects the API from abuse.
- **Mock Simulation**: High-fidelity simulation of Solana network conditions (latency, slippage, fees).

## 🛠 Tech Stack

- **Runtime**: Node.js + TypeScript
- **API Framework**: Fastify (with built-in WebSocket support)
- **Queue**: BullMQ + Redis
- **Database**: PostgreSQL (Order History)
- **Testing**: Jest

## 📦 Installation

1.  **Clone the repository**
    ```bash
    git clone <repo-url>
    cd dex-order-execution-engine
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Start Infrastructure (Redis + Postgres)**
    ```bash
    docker-compose up -d
    ```

4.  **Run Migrations**
    ```bash
    npm run db:migrate
    ```

5.  **Start Development Server**
    ```bash
    npm run dev
    ```

## 🧪 Testing

- **Run Unit & Integration Tests**:
    ```bash
    npm test
    ```
- **Run Test Client (Simulate User)**:
    ```bash
    npm run test:client
    ```
- **Run Concurrent Load Test**:
    ```bash
    npm run test:concurrent
    ```

## 📖 Design Decisions

### Why Market Orders?
We chose **Market Orders** as the primary order type because they demonstrate the core value of a DEX aggregator: **speed and best price execution**. Users want to swap tokens *now* at the best rate.
- **Extensibility**:
    - **Limit Orders**: Can be added by introducing a "price watcher" service that triggers the existing execution flow only when the target price is met.
    - **Sniper Orders**: Can be implemented by listening to on-chain "New Pool" events and triggering the execution flow immediately upon detection.

### Architecture

```mermaid
graph TD
    Client[Client] -->|POST /orders| API[Fastify API]
    Client -->|WS /orders/:id| API
    API -->|Create Order| DB[(PostgreSQL)]
    API -->|Add Job| Queue[Redis Queue]
    Queue -->|Process Job| Worker[Order Worker]
    Worker -->|Get Quote| Router[DEX Router]
    Router -->|Raydium| Raydium[Mock Raydium]
    Router -->|Meteora| Meteora[Mock Meteora]
    Worker -->|Update Status| DB
    Worker -->|Emit Event| API
    API -->|Push Update| Client
```

- **Fastify**: Chosen for its low overhead and native WebSocket support, essential for high-frequency trading updates.
- **BullMQ**: Provides robust queue management with exponential backoff, ensuring that network blips don't cause failed trades.
- **Mock Router**: Designed with interfaces that mirror real SDKs (`getQuote`, `executeSwap`), making the transition to `@solana/web3.js` seamless.

## 🔗 API Endpoints

### `POST /api/orders/execute`
Submit a new order.
**Body**:
```json
{
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amountIn": 1.0,
  "slippage": 0.01,
  "walletAddress": "..."
}
```

### `WS /api/orders/execute/:orderId`
Connect to stream status updates.

## 📝 License
MIT


## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd assignment-eterna
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server
PORT=3000
HOST=0.0.0.0

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dex_orders
DB_USER=postgres
DB_PASSWORD=postgres

# Order Processing
MAX_CONCURRENT_ORDERS=10
ORDER_RATE_LIMIT=100
MAX_RETRIES=3
```

### 4. Database Setup

```bash
# Create database
createdb dex_orders

# Run migrations
npm run db:migrate
```

### 5. Start Services

**Option A: Local Services**
```bash
# Start Redis
redis-server

# Start PostgreSQL (if not running)
# Varies by OS - e.g., on macOS: brew services start postgresql
```

**Option B: Docker Compose** 
```bash
docker-compose up -d
```

### 6. Run Application

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

Server runs on `http://localhost:3000`

## 📡 API Documentation

### Create Order

**POST** `/api/orders/execute`

```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "market",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": 100,
    "slippage": 0.01,
    "walletAddress": "YourWalletAddress"
  }'
```

**Response:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "Order created and queued",
  "websocketUrl": "/api/orders/execute/550e8400-e29b-41d4-a716-446655440000"
}
```

### WebSocket Status Updates

**GET** `/api/orders/execute/:orderId` (WebSocket upgrade)

```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/execute/550e8400-e29b-41d4-a716-446655440000');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Status:', update.status, update.data);
};
```

**Status Progression:**
1. `pending` - Order received and validated
2. `routing` - Fetching quotes from Raydium and Meteora
3. `building` - Creating transaction for selected DEX
4. `submitted` - Transaction sent to network
5. `confirmed` - Execution successful (includes txHash, executedPrice, amountOut)
6. `failed` - Error occurred (includes error message, retry attempt)

**Sample WebSocket Messages:**

```json
// Routing status with DEX comparison
{
  "type": "status",
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "routing",
  "timestamp": "2025-11-19T10:30:15.000Z",
  "data": {
    "quotes": [
      {
        "dex": "raydium",
        "price": 1.0,
        "fee": 0.3,
        "amountOut": 99.7,
        "priceImpact": 0.01,
        "estimatedGas": 5000
      },
      {
        "dex": "meteora",
        "price": 1.02,
        "fee": 0.2,
        "amountOut": 101.8,
        "priceImpact": 0.008,
        "estimatedGas": 4500
      }
    ],
    "selectedQuote": {
      "dex": "meteora",
      "price": 1.02,
      "fee": 0.2,
      "amountOut": 101.8
    }
  }
}

// Confirmed status with execution details
{
  "type": "status",
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "confirmed",
  "timestamp": "2025-11-19T10:30:20.000Z",
  "data": {
    "dex": "meteora",
    "txHash": "5kMzR...[88 chars]...w3pL",
    "executedPrice": 1.015,
    "amountOut": 101.3
  }
}
```

### Get Order Status (HTTP)

**GET** `/api/orders/:orderId`

```bash
curl http://localhost:3000/api/orders/550e8400-e29b-41d4-a716-446655440000
```

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Test Coverage

```bash
npm test -- --coverage
```

### Test Suites

1. **DEX Router Tests** (`dex-router.test.ts`) - 12 tests
   - Quote fetching (Raydium/Meteora)
   - Price comparison logic
   - Best route selection
   - Order validation

2. **Order Queue Tests** (`order-queue.test.ts`) - 8 tests
   - Queue operations
   - Concurrent processing
   - Status updates
   - Error handling & retries

3. **WebSocket Integration Tests** (`websocket.integration.test.ts`) - 10 tests
   - Connection lifecycle
   - Status streaming
   - Multiple concurrent orders
   - Error scenarios

**Total: 30+ tests** covering routing logic, queue behavior, and WebSocket lifecycle.

## 🐳 Docker Deployment

### Local Development

```bash
docker-compose up -d
```

Includes Redis and PostgreSQL services.

### Production Deployment

```dockerfile
# Build image
docker build -t dex-order-engine .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/dex_orders \
  -e REDIS_HOST=redis-host \
  dex-order-engine
```

## 📊 DEX Routing Logic

### Quote Comparison

The engine fetches quotes from both DEXs in parallel (~200-300ms):

```typescript
// Raydium: 0.3% fee, 5000-7000 lamports gas
// Meteora: 0.2% fee, 4500-6500 lamports gas

const netAmount = quote.amountOut - quote.estimatedGas;
const bestDex = quotes.reduce((best, current) => 
  current.netAmount > best.netAmount ? current : best
);
```

### Price Variance Simulation

- **Raydium**: 98-102% of base price (±2%)
- **Meteora**: 97-102% of base price (±2.5%, wider range)
- **Execution Slippage**: 0-0.5% during transaction

### Routing Decisions Logged

```
Order abc123: Best quote from meteora
  Price: 1.02
  Amount Out: 101.8
  Fee: 0.2
  Net: 101.3 (after gas)
```

## 🔧 Configuration

### Queue Settings

- **Concurrency**: 10 simultaneous orders
- **Rate Limit**: 100 orders per minute
- **Retry Policy**: Exponential backoff (1s, 2s, 4s)
- **Max Retries**: 3 attempts before failure

### Slippage Protection

- Default: 1% (configurable per order)
- Applied during execution
- Prevents unfavorable price movements

## 📦 Postman Collection

Import `postman_collection.json` for ready-to-use API requests:

- Create Market Order
- WebSocket Connection
- Get Order Status
- Concurrent Order Submission (5 orders)
- Error Scenarios

[Download Collection](./postman_collection.json)

## 🎥 Demo Video

**Video Link**: [YouTube Demo](YOUR_VIDEO_LINK_HERE)

Demonstrates:
- Submitting 5 concurrent orders
- Real-time WebSocket status updates
- DEX routing decisions in console
- Queue processing multiple orders
- Complete execution flow (pending → confirmed)

## 📈 Performance Metrics

- **Order Creation**: <50ms
- **DEX Quote Fetching**: 200-300ms (parallel)
- **Transaction Execution**: 2-3 seconds (simulated)
- **Total Order Time**: ~3-4 seconds
- **Throughput**: 10 concurrent orders, 100/min rate limit

## 🔒 Error Handling

### Automatic Retry

- Failed orders retry 3 times with exponential backoff
- Retry attempts logged in database
- Final failure reason persisted for post-mortem

### Failure Scenarios

1. **Validation Error**: Invalid tokens, amounts, or slippage
2. **DEX Unavailable**: One DEX failing (routes to available DEX)
3. **Execution Failure**: Transaction simulation failure
4. **Network Timeout**: Connection issues with Redis/PostgreSQL

All failures emit `failed` status via WebSocket with error details.

## 🌐 Deployment

### Hosted URL

**Live API**: `YOUR_HOSTED_URL_HERE`

Deployed on: [Render/Railway/Fly.io - Free Tier]

### Health Check

```bash
curl https://your-hosted-url.com/health
```

## 🛠️ Development

### Project Structure

```
src/
├── index.ts                 # Fastify server & WebSocket setup
├── config/                  # Environment configuration
├── types/                   # TypeScript interfaces
├── services/
│   ├── dex-router.ts       # Mock DEX integration
│   └── order-queue.ts      # BullMQ queue management
├── db/
│   ├── index.ts            # PostgreSQL client
│   └── migrate.ts          # Database migrations
└── __tests__/              # Test suites
```

### Adding Real DEX Integration

Replace `MockDexRouter` with actual SDK calls:

```typescript
// Install SDKs
npm install @raydium-io/raydium-sdk-v2 @meteora-ag/dynamic-amm-sdk

// Update dex-router.ts
import { Raydium } from '@raydium-io/raydium-sdk-v2';
import { AmmImpl } from '@meteora-ag/dynamic-amm-sdk';

// Implement getRaydiumQuote with real SDK
async getRaydiumQuote(...) {
  const raydium = await Raydium.load({...});
  const quote = await raydium.getSwapQuote(...);
  return quote;
}
```

## 📝 License

MIT

## 🤝 Contributing

This is an assignment project. For production use, consider:
- Real DEX SDK integration
- Authentication & rate limiting
- Advanced monitoring & logging
- Kubernetes deployment
- Load balancing for WebSocket connections

## 📞 Support

For issues or questions, please open a GitHub issue or contact [your-email@example.com].

---

**Built with ❤️ for high-performance DEX aggregation**
