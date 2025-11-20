# Testing Guide

Comprehensive guide for testing the DEX Order Execution Engine.

## 🧪 Test Suite Overview

### Total Tests: 30+

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| DEX Router | 12 | Routing logic, quotes, validation |
| Order Queue | 8 | Queue ops, retries, status |
| WebSocket | 10+ | Connection, streaming, lifecycle |

## 🚀 Quick Start

### Run All Tests
```bash
npm test
```

### Run with Coverage
```bash
npm test -- --coverage
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Run Specific Test File
```bash
npm test dex-router.test.ts
```

## 📋 Test Categories

### 1. DEX Router Tests (`dex-router.test.ts`)

**What's Tested:**
- ✅ Raydium quote fetching
- ✅ Meteora quote fetching
- ✅ Fee calculations (0.3% Raydium, 0.2% Meteora)
- ✅ Price variance simulation
- ✅ Parallel quote fetching
- ✅ Best quote selection logic
- ✅ Swap execution timing (2-3s)
- ✅ Transaction hash generation
- ✅ Slippage application
- ✅ Order validation (tokens, amounts, slippage)

**Key Test Cases:**
```typescript
// Quote structure validation
it('should return valid quote', async () => {
  const quote = await router.getRaydiumQuote('SOL', 'USDC', 100);
  expect(quote).toHaveProperty('dex', DexType.RAYDIUM);
  expect(quote.price).toBeGreaterThan(0);
});

// Fee accuracy
it('should apply correct fee rate', async () => {
  const quote = await router.getRaydiumQuote('SOL', 'USDC', 100);
  expect(quote.fee).toBeCloseTo(100 * 0.003, 4);
});

// Best quote selection
it('should select highest net output', async () => {
  const quotes = await router.getAllQuotes('SOL', 'USDC', 100);
  const best = router.selectBestQuote(quotes);
  const netAmount = best.amountOut - best.estimatedGas;
  // Verify it's the maximum
});
```

### 2. Order Queue Tests (`order-queue.test.ts`)

**What's Tested:**
- ✅ Order queueing
- ✅ Status update emissions
- ✅ Complete order lifecycle
- ✅ DEX selection logic
- ✅ Error handling
- ✅ Retry mechanism
- ✅ Concurrent processing (5 orders)
- ✅ Database interactions

**Key Test Cases:**
```typescript
// Status progression
it('should emit all status updates', (done) => {
  queue.on('orderUpdate', (update) => {
    if (update.status === OrderStatus.CONFIRMED) {
      expect(statusUpdates).toContain(OrderStatus.PENDING);
      expect(statusUpdates).toContain(OrderStatus.ROUTING);
      // ... all statuses
      done();
    }
  });
  await queue.addOrder(mockOrder);
});

// DEX selection
it('should select best DEX', (done) => {
  queue.on('orderUpdate', (update) => {
    if (update.status === OrderStatus.ROUTING) {
      expect(update.data.selectedQuote.dex).toBe('meteora');
      done();
    }
  });
});
```

### 3. WebSocket Integration Tests (`websocket.integration.test.ts`)

**What's Tested:**
- ✅ HTTP order creation
- ✅ WebSocket connection
- ✅ Connection confirmation
- ✅ Status streaming (all 6 states)
- ✅ DEX routing info transmission
- ✅ Execution details (txHash, price, amount)
- ✅ Connection lifecycle
- ✅ Ping-pong messages
- ✅ Auto-close on completion
- ✅ Error handling
- ✅ Concurrent connections (5 orders)

**Key Test Cases:**
```typescript
// Full lifecycle
it('should receive all status updates', (done) => {
  const ws = new WebSocket(`ws://localhost:3000/api/orders/execute/${orderId}`);
  
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    
    if (message.status === OrderStatus.CONFIRMED) {
      expect(message.data).toHaveProperty('txHash');
      done();
    }
  });
}, 30000);

// Concurrent processing
it('should handle 5 concurrent orders', async () => {
  const results = await Promise.all(
    Array(5).fill(null).map(() => createOrder())
  );
  
  expect(results).toHaveLength(5);
  // Connect all WebSockets...
});
```

## 🔍 Manual Testing

### 1. Using Test Client (Recommended)

**Single Order:**
```bash
npm run test:client
```

**Expected Output:**
```
===========================================================
TEST: Single Market Order
===========================================================

📤 Creating order...
{
  "type": "market",
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amountIn": 100,
  ...
}

✅ Order created: 550e8400-e29b-41d4-a716-446655440000

✅ WebSocket connected for order: 550e8400-...
🔗 Connection confirmed at 2025-11-19T...

📊 Status: PENDING
   Timestamp: 2025-11-19T10:30:15.000Z

📊 Status: ROUTING
   📈 DEX Quotes:
      RAYDIUM: 99.70 (fee: 0.3, gas: 5234)
      METEORA: 101.80 (fee: 0.2, gas: 4567)
   ✨ Selected: METEORA

📊 Status: BUILDING
   Timestamp: 2025-11-19T10:30:16.000Z

📊 Status: SUBMITTED
   🔗 TX Hash: 5kMzR...

📊 Status: CONFIRMED
   💰 Executed Price: 1.015
   💵 Amount Out: 101.3

✅ Order CONFIRMED
🎉 Order completed. Connection closing...
```

**Concurrent Orders:**
```bash
npm run test:concurrent
```

**Expected Output:**
```
===========================================================
TEST: 5 Concurrent Market Orders
===========================================================

📤 Creating 5 orders simultaneously...

✅ All orders created in 243ms
   Order 1: 550e8400-...
   Order 2: 660f9511-...
   Order 3: 770g0622-...
   Order 4: 880h1733-...
   Order 5: 990i2844-...

🔌 Connecting to all WebSockets...

[5 orders processing concurrently with status updates]

✅ All orders completed in 4.52s
```

### 2. Using Postman Collection

**Import Collection:**
1. Open Postman
2. Import `postman_collection.json`
3. Set `base_url` variable to `http://localhost:3000`

**Test Scenarios:**

**Single Order:**
1. Run "Create Market Order"
2. Copy `orderId` from response
3. Set `orderId` variable
4. Use Postman WebSocket to connect:
   ```
   ws://localhost:3000/api/orders/execute/{{orderId}}
   ```

**Concurrent Orders:**
1. Select "Concurrent Orders - Order 1" through "Order 5"
2. Right-click → "Run"
3. Select all 5 requests
4. Click "Run"
5. View results

**Error Scenarios:**
- Run "Error - Invalid Order Type" (expect 400)
- Run "Error - Missing Required Fields" (expect 400)
- Run "Error - Invalid Order ID" (expect 404)

### 3. Using Demo HTML

**Setup:**
1. Start server: `npm run dev`
2. Open `demo.html` in browser
3. Enter API URL: `http://localhost:3000`

**Test Flow:**
1. Fill form with order details
2. Click "Submit Order"
3. Watch real-time status updates
4. See DEX quotes comparison
5. View final execution details

**Features:**
- ✅ Visual status timeline
- ✅ Color-coded status indicators
- ✅ DEX quote comparison cards
- ✅ Connection status indicator
- ✅ Transaction details display

### 4. Using cURL + wscat

**Create Order (cURL):**
```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "market",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": 100,
    "slippage": 0.01,
    "walletAddress": "TestWallet123"
  }'
```

**Connect WebSocket (wscat):**
```bash
# Install wscat
npm install -g wscat

# Connect
wscat -c ws://localhost:3000/api/orders/execute/ORDER_ID

# Send ping
{"type":"ping"}

# Receive pong and status updates
```

## 📊 Test Coverage

### View Coverage Report
```bash
npm test -- --coverage
```

**Expected Coverage:**
```
File                  | % Stmts | % Branch | % Funcs | % Lines |
----------------------|---------|----------|---------|---------|
All files             |   85.23 |    78.45 |   82.14 |   86.32 |
 config/index.ts      |  100.00 |   100.00 |  100.00 |  100.00 |
 db/index.ts          |   87.50 |    75.00 |   85.71 |   88.23 |
 services/dex-router  |   92.31 |    85.71 |   90.00 |   93.75 |
 services/order-queue |   83.33 |    76.92 |   80.00 |   84.61 |
 types/index.ts       |  100.00 |   100.00 |  100.00 |  100.00 |
```

### View HTML Coverage Report
```bash
npm test -- --coverage
open coverage/lcov-report/index.html
```

## 🐛 Debugging Tests

### Enable Verbose Output
```bash
npm test -- --verbose
```

### Run Single Test
```bash
npm test -- -t "should return valid quote"
```

### Debug in VS Code

**Add to `.vscode/launch.json`:**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Debug Specific Test
```bash
node --inspect-brk node_modules/.bin/jest --runInBand dex-router.test.ts
```

## ⚡ Performance Testing

### Concurrent Orders Test
```bash
# Test with 10 concurrent orders
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/orders/execute \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"market\",\"tokenIn\":\"SOL\",\"tokenOut\":\"USDC\",\"amountIn\":$((100*i)),\"slippage\":0.01,\"walletAddress\":\"Wallet$i\"}" &
done
wait
```

### Load Testing with Apache Bench
```bash
# Install Apache Bench
# Ubuntu: sudo apt-get install apache2-utils
# macOS: brew install httpd

# Test health endpoint
ab -n 1000 -c 10 http://localhost:3000/health

# Results should show:
# - Requests per second: >500
# - Mean response time: <20ms
# - No failed requests
```

## 🔒 Security Testing

### Input Validation Tests
```bash
# Invalid order type
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{"type":"invalid","tokenIn":"SOL","tokenOut":"USDC","amountIn":100}'

# Expected: 400 Bad Request

# Negative amount
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{"type":"market","tokenIn":"SOL","tokenOut":"USDC","amountIn":-100}'

# Expected: 400 or validation error

# SQL injection attempt
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{"type":"market","tokenIn":"SOL","tokenOut":"USDC","amountIn":100,"walletAddress":"'; DROP TABLE orders; --"}'

# Expected: Safely handled (parameterized queries)
```

## 📝 Test Checklist

Before submitting:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Test coverage >80%
- [ ] Manual test with test client succeeds
- [ ] Concurrent order test succeeds
- [ ] Postman collection works
- [ ] Demo HTML works
- [ ] No console errors in browser
- [ ] WebSocket connections close properly
- [ ] Database queries are optimized
- [ ] Error scenarios handled gracefully

## 🆘 Troubleshooting

### Tests Fail to Start
```bash
# Clear Jest cache
npm test -- --clearCache

# Reinstall dependencies
rm -rf node_modules
npm install
```

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

# Create database
createdb dex_orders

# Run migrations
npm run db:migrate
```

### WebSocket Tests Timeout
- Ensure server is running: `npm run dev`
- Increase timeout in test: `it('test', (done) => {...}, 30000)`
- Check for port conflicts

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Fastify Testing](https://www.fastify.io/docs/latest/Guides/Testing/)
- [WebSocket Testing](https://github.com/websockets/ws#sending-and-receiving-text-data)
- [Postman WebSocket](https://learning.postman.com/docs/sending-requests/supported-api-frameworks/websocket/)

---

**Happy Testing! 🧪**
