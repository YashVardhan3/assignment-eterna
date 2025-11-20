const WebSocket = require('ws');

// Configuration
const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

// Create order via HTTP
async function createOrder(orderData) {
  const response = await fetch(`${BASE_URL}/api/orders/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderData)
  });
  
  return response.json();
}

// Connect to WebSocket and listen for updates
function connectWebSocket(orderId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/api/orders/execute/${orderId}`);
    
    const updates = [];
    
    ws.on('open', () => {
      console.log(`\n✅ WebSocket connected for order: ${orderId}`);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'connected') {
        console.log(`🔗 Connection confirmed at ${message.timestamp}`);
      }
      
      if (message.type === 'status') {
        updates.push(message);
        
        console.log(`\n📊 Status: ${message.status.toUpperCase()}`);
        console.log(`   Timestamp: ${message.timestamp}`);
        
        if (message.data) {
          if (message.data.quotes) {
            console.log(`   📈 DEX Quotes:`);
            message.data.quotes.forEach(q => {
              console.log(`      ${q.dex.toUpperCase()}: ${q.amountOut.toFixed(2)} (fee: ${q.fee}, gas: ${q.estimatedGas})`);
            });
          }
          
          if (message.data.selectedQuote) {
            console.log(`   ✨ Selected: ${message.data.selectedQuote.dex.toUpperCase()}`);
          }
          
          if (message.data.txHash) {
            console.log(`   🔗 TX Hash: ${message.data.txHash.substring(0, 20)}...`);
          }
          
          if (message.data.executedPrice) {
            console.log(`   💰 Executed Price: ${message.data.executedPrice}`);
            console.log(`   💵 Amount Out: ${message.data.amountOut}`);
          }
          
          if (message.data.error) {
            console.log(`   ❌ Error: ${message.data.error}`);
          }
        }
        
        // Check for final status
        if (message.status === 'confirmed' || message.status === 'failed') {
          console.log(`\n${message.status === 'confirmed' ? '✅' : '❌'} Order ${message.status.toUpperCase()}`);
        }
      }
      
      if (message.type === 'complete') {
        console.log(`\n🎉 Order completed. Connection closing...\n`);
        resolve(updates);
      }
    });
    
    ws.on('close', () => {
      console.log(`🔌 WebSocket disconnected\n`);
      resolve(updates);
    });
    
    ws.on('error', (error) => {
      console.error(`❌ WebSocket error:`, error.message);
      reject(error);
    });
  });
}

// Test single order
async function testSingleOrder() {
  console.log('='.repeat(60));
  console.log('TEST: Single Market Order');
  console.log('='.repeat(60));
  
  const orderData = {
    type: 'market',
    tokenIn: 'SOL',
    tokenOut: 'USDC',
    amountIn: 100,
    slippage: 0.01,
    walletAddress: 'TestWallet123456789'
  };
  
  console.log('\n📤 Creating order...');
  console.log(JSON.stringify(orderData, null, 2));
  
  const result = await createOrder(orderData);
  console.log(`\n✅ Order created: ${result.orderId}`);
  console.log(`   WebSocket URL: ${result.websocketUrl}`);
  
  await connectWebSocket(result.orderId);
}

// Test concurrent orders
async function testConcurrentOrders() {
  console.log('='.repeat(60));
  console.log('TEST: 5 Concurrent Market Orders');
  console.log('='.repeat(60));
  
  const orders = [
    { tokenIn: 'SOL', tokenOut: 'USDC', amountIn: 25, walletAddress: 'Concurrent1' },
    { tokenIn: 'SOL', tokenOut: 'USDC', amountIn: 75, walletAddress: 'Concurrent2' },
    { tokenIn: 'SOL', tokenOut: 'USDC', amountIn: 150, walletAddress: 'Concurrent3' },
    { tokenIn: 'SOL', tokenOut: 'USDC', amountIn: 200, walletAddress: 'Concurrent4' },
    { tokenIn: 'SOL', tokenOut: 'USDC', amountIn: 300, walletAddress: 'Concurrent5' }
  ].map(o => ({ ...o, type: 'market', slippage: 0.01 }));
  
  console.log(`\n📤 Creating ${orders.length} orders simultaneously...`);
  
  const startTime = Date.now();
  const results = await Promise.all(orders.map(order => createOrder(order)));
  const createTime = Date.now() - startTime;
  
  console.log(`\n✅ All orders created in ${createTime}ms`);
  results.forEach((r, i) => {
    console.log(`   Order ${i + 1}: ${r.orderId}`);
  });
  
  console.log(`\n🔌 Connecting to all WebSockets...`);
  
  const wsStartTime = Date.now();
  await Promise.all(results.map(r => connectWebSocket(r.orderId)));
  const totalTime = Date.now() - wsStartTime;
  
  console.log(`\n✅ All orders completed in ${(totalTime / 1000).toFixed(2)}s`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'single';
  
  try {
    if (testType === 'concurrent') {
      await testConcurrentOrders();
    } else {
      await testSingleOrder();
    }
    
    console.log('\n✅ Test completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { createOrder, connectWebSocket };
