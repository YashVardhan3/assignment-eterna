# Project Structure

Complete overview of the DEX Order Execution Engine codebase.

## 📁 Directory Layout

```
assignment-eterna/
├── src/                          # Source code
│   ├── __tests__/               # Test suites
│   │   ├── dex-router.test.ts   # DEX routing logic tests
│   │   ├── order-queue.test.ts  # Queue management tests
│   │   └── websocket.integration.test.ts  # WebSocket tests
│   ├── config/                  # Configuration
│   │   └── index.ts            # Environment configuration
│   ├── db/                      # Database layer
│   │   ├── index.ts            # PostgreSQL client & queries
│   │   └── migrate.ts          # Database migrations
│   ├── services/                # Business logic
│   │   ├── dex-router.ts       # Mock DEX integration
│   │   └── order-queue.ts      # BullMQ queue management
│   ├── types/                   # TypeScript definitions
│   │   └── index.ts            # Shared types & interfaces
│   └── index.ts                 # Application entry point
│
├── .github/                     # GitHub workflows
│   └── workflows/
│       └── ci-cd.yml           # CI/CD pipeline
│
├── dist/                        # Compiled JavaScript (generated)
├── coverage/                    # Test coverage reports (generated)
├── node_modules/                # Dependencies (generated)
│
├── .env                         # Environment variables (create from .env.example)
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
│
├── package.json                 # Dependencies & scripts
├── tsconfig.json               # TypeScript configuration
├── jest.config.js              # Jest test configuration
│
├── Dockerfile                   # Docker image definition
├── docker-compose.yml          # Local dev environment
│
├── setup.sh                     # Unix setup script
├── setup.bat                    # Windows setup script
├── test-client.js              # WebSocket test client
│
├── demo.html                    # Interactive WebSocket demo
├── postman_collection.json     # API test collection
│
├── README.md                    # Main documentation
├── QUICKSTART.md               # Quick setup guide
├── DEPLOYMENT.md               # Deployment instructions
└── PROJECT_STRUCTURE.md        # This file
```

---

## 🔧 Core Components

### Entry Point: `src/index.ts`

Main application file that:
- Initializes Fastify server
- Registers WebSocket plugin
- Sets up API routes
- Manages WebSocket connections
- Handles graceful shutdown

**Key Routes:**
- `GET /health` - Health check
- `POST /api/orders/execute` - Create order
- `GET /api/orders/:orderId` - Get order status
- `WS /api/orders/execute/:orderId` - WebSocket status stream

### DEX Router: `src/services/dex-router.ts`

Mock implementation of DEX aggregation:
- `getRaydiumQuote()` - Fetch Raydium price quote
- `getMeteorQuote()` - Fetch Meteora price quote
- `getAllQuotes()` - Parallel quote fetching
- `selectBestQuote()` - Choose optimal DEX
- `executeSwap()` - Simulate transaction execution
- `validateOrder()` - Input validation

**Quote Selection Logic:**
```typescript
netAmount = amountOut - estimatedGas
bestDex = max(netAmount) across all quotes
```

### Order Queue: `src/services/order-queue.ts`

BullMQ-based queue system:
- `addOrder()` - Queue new order
- `processOrder()` - Execute order workflow
- `updateStatus()` - Emit status updates
- `getOrderStatus()` - Retrieve order state
- `getOrderHistory()` - Fetch status timeline

**Order Lifecycle:**
1. Validate order parameters
2. Fetch quotes from all DEXs
3. Select best quote
4. Build transaction
5. Submit to network
6. Confirm execution

**Retry Logic:**
- Max 3 attempts
- Exponential backoff (1s → 2s → 4s)
- Failure reason persisted to database

### Database: `src/db/index.ts`

PostgreSQL integration with connection pooling:
- `initialize()` - Create tables & indexes
- `createOrder()` - Insert new order
- `updateOrderStatus()` - Update order state
- `addOrderHistory()` - Log status change
- `getOrder()` - Retrieve order by ID
- `getOrderHistory()` - Get status timeline
- `getRecentOrders()` - List recent orders

**Schema:**
```sql
-- Orders table
CREATE TABLE orders (
  id VARCHAR(36) PRIMARY KEY,
  type VARCHAR(20),
  token_in VARCHAR(100),
  token_out VARCHAR(100),
  amount_in DECIMAL,
  slippage DECIMAL,
  wallet_address VARCHAR(100),
  status VARCHAR(20),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Order history table
CREATE TABLE order_history (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(36),
  status VARCHAR(20),
  data JSONB,
  created_at TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

### Configuration: `src/config/index.ts`

Centralized environment configuration:
- Server settings (port, host)
- Redis connection
- PostgreSQL connection
- Order processing limits
- DEX fee rates

### Types: `src/types/index.ts`

TypeScript interfaces for type safety:
- `Order` - Order entity
- `OrderRequest` - API request body
- `OrderStatus` - Status enum
- `OrderType` - Order type enum
- `DexType` - DEX identifier enum
- `DexQuote` - Quote structure
- `ExecutionResult` - Execution details
- `OrderStatusUpdate` - WebSocket message

---

## 🧪 Testing

### Unit Tests

**`dex-router.test.ts`** (12 tests)
- Quote fetching validation
- Fee calculation accuracy
- Price variance simulation
- Best quote selection
- Execution timing
- Input validation

**`order-queue.test.ts`** (8 tests)
- Queue operations
- Status update emissions
- Concurrent processing
- Error handling
- Retry mechanism
- Database interactions

### Integration Tests

**`websocket.integration.test.ts`** (10 tests)
- HTTP → WebSocket upgrade
- Status streaming
- Connection lifecycle
- Concurrent orders
- Error scenarios
- Message format validation

**Running Tests:**
```bash
npm test                    # Run all tests
npm test -- --coverage      # With coverage report
npm test -- --watch         # Watch mode
```

---

## 🐳 Docker Configuration

### `Dockerfile`

Multi-stage build:
1. **Builder stage:** Compile TypeScript
2. **Production stage:** Run compiled code

Optimizations:
- Non-root user for security
- Production dependencies only
- Health check endpoint
- Minimal Alpine base image

### `docker-compose.yml`

Local development stack:
- **app:** Node.js application
- **postgres:** PostgreSQL 15
- **redis:** Redis 7

Health checks ensure services start in correct order.

---

## 📦 Package Scripts

```json
{
  "dev": "tsx watch src/index.ts",           // Development with hot reload
  "build": "tsc",                             // Compile TypeScript
  "start": "node dist/index.js",              // Production server
  "test": "jest --coverage",                  // Run tests with coverage
  "test:watch": "jest --watch",               // Test watch mode
  "test:client": "node test-client.js",       // WebSocket test (single)
  "test:concurrent": "node test-client.js concurrent",  // 5 concurrent orders
  "db:migrate": "tsx src/db/migrate.ts",      // Database migrations
  "lint": "eslint src --ext .ts"              // Code linting
}
```

---

## 🔄 Request Flow

### HTTP Request Flow
```
1. Client sends POST /api/orders/execute
2. Fastify validates request body
3. Generate orderId (UUID)
4. Create Order entity
5. Save to PostgreSQL
6. Add to BullMQ queue
7. Return orderId + WebSocket URL
```

### WebSocket Status Flow
```
1. Client connects WS /api/orders/execute/:orderId
2. Server sends connection confirmation
3. Worker processes order from queue
4. Each status change emits event
5. Event listener sends WebSocket message
6. Client receives real-time updates
7. Connection closes after final status
```

### Order Processing Flow
```
1. PENDING    - Order validated and queued
2. ROUTING    - Fetch quotes (parallel)
              - Compare Raydium vs Meteora
              - Select best net amount
3. BUILDING   - Construct transaction
4. SUBMITTED  - Send to network
5. CONFIRMED  - Success + execution details
   OR
   FAILED     - Error + retry info
```

---

## 🎨 Demo & Testing Tools

### `demo.html`

Interactive web UI for testing:
- Create orders via form
- Real-time WebSocket updates
- Visual status timeline
- DEX quote comparison display
- Color-coded status indicators

### `test-client.js`

Node.js WebSocket test client:
- Single order test
- Concurrent order test (5 orders)
- Console output with emojis
- Performance timing
- Error handling

### `postman_collection.json`

13 pre-configured requests:
- Health check
- Single order creation
- Concurrent orders (5x)
- Error scenarios
- Variable support

---

## 🔐 Environment Variables

All configuration via `.env`:

```env
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Redis
REDIS_HOST=host
REDIS_PORT=6379
REDIS_PASSWORD=

# PostgreSQL
DATABASE_URL=postgresql://user:pass@host:port/db
DB_HOST=host
DB_PORT=port
DB_NAME=db
DB_USER=postgresql
DB_PASSWORD=

# Processing
MAX_CONCURRENT_ORDERS=10
ORDER_RATE_LIMIT=100
MAX_RETRIES=3

# DEX
SLIPPAGE_TOLERANCE=0.01
RAYDIUM_FEE=0.003
METEORA_FEE=0.002
```

---

## 📊 Key Design Decisions

### Why Market Orders?
- Immediate execution demonstrates real-time capabilities
- Simple to understand and test
- Foundation for limit/sniper orders

### Why Mock Implementation?
- Focus on architecture and flow
- No external dependencies
- Predictable for testing
- Easy to swap for real SDKs

### Why BullMQ?
- Redis-backed reliability
- Built-in retry mechanism
- Concurrent processing
- Rate limiting support

### Why PostgreSQL + Redis?
- PostgreSQL: Persistent order history
- Redis: Fast queue operations
- Separation of concerns

### Why Fastify?
- Built-in WebSocket support
- High performance
- TypeScript-friendly
- Active community

---

## 🚀 Extension Points

### Adding Real DEX Integration

Replace `MockDexRouter` in `src/services/dex-router.ts`:

```typescript
import { Raydium } from '@raydium-io/raydium-sdk-v2';
import { AmmImpl } from '@meteora-ag/dynamic-amm-sdk';

async getRaydiumQuote(...) {
  const raydium = await Raydium.load({...});
  return await raydium.getSwapQuote(...);
}
```

### Adding Limit Orders

1. Add price monitor in `src/services/price-monitor.ts`
2. Check target price in polling loop
3. Queue order when price reached
4. Use existing execution pipeline

### Adding Authentication

1. Add auth middleware in `src/middleware/auth.ts`
2. Validate JWT tokens
3. Associate orders with users
4. Add user_id to orders table

---

## 📝 Code Style

- **TypeScript:** Strict mode enabled
- **Async/Await:** Preferred over callbacks
- **Error Handling:** Try-catch with specific errors
- **Logging:** Structured logging with Pino
- **Naming:** camelCase for variables, PascalCase for classes
- **Comments:** JSDoc for public functions

---

## 🔍 Debugging

### Enable Verbose Logging

```typescript
// In src/index.ts
const app = Fastify({
  logger: {
    level: 'debug'  // Change from 'info'
  }
});
```

### View Redis Queue

```bash
redis-cli
> KEYS bullmq:order-execution:*
> LRANGE bullmq:order-execution:active 0 -1
```

### Query Database

```bash
psql dex_orders
> SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;
> SELECT * FROM order_history WHERE order_id = 'xxx';
```

---

## 📚 Additional Resources

- [Fastify Documentation](https://www.fastify.io/)
- [BullMQ Guide](https://docs.bullmq.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing](https://jestjs.io/docs/getting-started)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
