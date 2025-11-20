import WebSocket from 'ws';
import { OrderStatus, OrderType } from '../types';

// Note: These are integration tests that require the server to be running
// Run with: npm run dev (in one terminal) and npm test (in another)

describe('WebSocket Integration Tests', () => {
  const BASE_URL = 'http://127.0.0.1:3000';
  const WS_URL = 'ws://127.0.0.1:3000';
  
  let orderId: string;
  let isServerRunning = false;
  
  beforeAll(async () => {
    // Check if server is running
    try {
      const response = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
      isServerRunning = response.ok;
    } catch (error) {
      isServerRunning = false;
      console.log('⚠️  Server not running - skipping WebSocket integration tests');
    }
  });
  
  afterAll(async () => {
    // Clean up any remaining connections
    await new Promise(resolve => setTimeout(resolve, 500));
  });
  
  // Helper function to create an order via HTTP
  async function createOrder() {
    const response = await fetch(`${BASE_URL}/api/orders/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        slippage: 0.01,
        walletAddress: '0xTestWallet123'
      })
    });
    
    return response.json();
  }
  
  // Helper function to connect to WebSocket
  function connectWebSocket(orderId: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}/api/orders/execute/${orderId}`);
      
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
      
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
    });
  }
  
  describe('Order execution flow', () => {
    it('should create order via POST and receive orderId', async () => {
      if (!isServerRunning) {
        console.log('Skipping - server not available');
        return;
      }
      
      const result: any = await createOrder();
      
      expect(result).toHaveProperty('orderId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('websocketUrl');
      expect((result as any).status).toBe('Order created and queued');
      
      orderId = result.orderId;
    });
    
    it('should connect to WebSocket with orderId', async () => {
      if (!isServerRunning) return;
      
      if (!orderId) {
        const result: any = await createOrder();
        orderId = result.orderId;
      }
      
      const ws = await connectWebSocket(orderId);
      
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      ws.close();
    });
    
    it('should receive all status updates via WebSocket', (done) => {
      if (!isServerRunning) {
        done();
        return;
      }

      createOrder().then(result => {
        const orderId = (result as any).orderId;
        const ws = new WebSocket(`${WS_URL}/api/orders/execute/${orderId}`);
        
        const receivedStatuses: string[] = [];
        
        ws.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'status') {
            receivedStatuses.push(message.status);
            
            // Check if we received the final status
            if (message.status === OrderStatus.CONFIRMED || message.status === OrderStatus.FAILED) {
              expect(receivedStatuses).toContain(OrderStatus.PENDING);
              expect(receivedStatuses).toContain(OrderStatus.ROUTING);
              expect(receivedStatuses).toContain(OrderStatus.BUILDING);
              expect(receivedStatuses).toContain(OrderStatus.SUBMITTED);
              
              if (message.status === OrderStatus.CONFIRMED) {
                expect(message.data).toHaveProperty('txHash');
                expect(message.data).toHaveProperty('executedPrice');
                expect(message.data).toHaveProperty('amountOut');
              }
              
              ws.close();
              done();
            }
          }
        });
        
        ws.on('error', (error) => {
          done(error);
        });
      });
    }, 30000); // 30 second timeout for full order execution
    
    it('should receive DEX routing information', (done) => {
      if (!isServerRunning) {
        done();
        return;
      }
      createOrder().then(result => {
        const orderId = (result as any).orderId;
        const ws = new WebSocket(`${WS_URL}/api/orders/execute/${orderId}`);
        
        ws.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'status' && message.status === OrderStatus.ROUTING && message.data?.quotes) {
            expect(message.data.quotes).toHaveLength(2);
            expect(message.data).toHaveProperty('selectedQuote');
            expect(message.data.selectedQuote).toHaveProperty('dex');
            
            ws.close();
            done();
          }
        });
      });
    }, 30000);
  });
  
  describe('WebSocket lifecycle', () => {
    it('should send connection confirmation on connect', (done) => {
      if (!isServerRunning) {
        done();
        return;
      }
      createOrder().then(result => {
        const orderId = (result as any).orderId;
        const ws = new WebSocket(`${WS_URL}/api/orders/execute/${orderId}`);
        
        ws.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'connected') {
            expect(message).toHaveProperty('orderId', orderId);
            expect(message).toHaveProperty('timestamp');
            ws.close();
            done();
          }
        });
      });
    });
    
    it('should handle ping-pong messages', (done) => {
      if (!isServerRunning) {
        done();
        return;
      }
      createOrder().then(result => {
        const orderId = (result as any).orderId;
        const ws = new WebSocket(`${WS_URL}/api/orders/execute/${orderId}`);
        
        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'ping' }));
        });
        
        ws.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'pong') {
            expect(message).toHaveProperty('timestamp');
            ws.close();
            done();
          }
        });
      });
    });
    
    it('should close connection after order completion', (done) => {
      if (!isServerRunning) {
        done();
        return;
      }
      createOrder().then(result => {
        const orderId = (result as any).orderId;
        const ws = new WebSocket(`${WS_URL}/api/orders/execute/${orderId}`);
        
        ws.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'complete') {
            expect(message).toHaveProperty('orderId', orderId);
          }
        });
        
        ws.on('close', () => {
          done();
        });
      });
    }, 30000);
  });
  
  describe('Error handling', () => {
    it('should handle invalid order ID', (done) => {
      if (!isServerRunning) {
        done();
        return;
      }
      const ws = new WebSocket(`${WS_URL}/api/orders/execute/invalid-order-id`);
      
      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'error') {
          expect(message.error).toBe('Order not found');
          done();
        }
      });
    });
  });
  
  describe('Concurrent order processing', () => {
    it('should handle multiple concurrent orders', async () => {
      if (!isServerRunning) return;
      const orderPromises = Array.from({ length: 5 }, () => createOrder());
      const results = await Promise.all(orderPromises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('orderId');
        expect((result as any).status).toBe('Order created and queued');
      });
      
      // Connect WebSocket for each order
      const wsPromises = results.map((result: any) => connectWebSocket(result.orderId));
      const connections = await Promise.all(wsPromises);
      
      expect(connections).toHaveLength(5);
      connections.forEach(ws => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
      });
    });
  });
});
