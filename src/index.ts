import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import { config } from './config';
import { database } from './db';
import { orderQueue } from './services/order-queue';
import { Order, OrderRequest, OrderStatus, OrderStatusUpdate, OrderType } from './types';

// Type for WebSocket connection
interface WSConnection {
  socket: WebSocket;
  send: (message: string) => void;
}

const app = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  }
});

// Register CORS
app.register(cors, {
  origin: true // Allow all origins for development
});

// Register rate limiting
app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
});

// WebSocket connections map
const connections = new Map<string, WSConnection>();

// Register WebSocket plugin
app.register(websocket);

// Health check endpoint
app.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Get order status endpoint
app.get('/api/orders/:orderId', async (request: FastifyRequest<{
  Params: { orderId: string }
}>, reply: FastifyReply) => {
  const { orderId } = request.params;
  
  const order = await orderQueue.getOrderStatus(orderId);
  
  if (!order) {
    return reply.code(404).send({ error: 'Order not found' });
  }
  
  const history = await orderQueue.getOrderHistory(orderId);
  
  return {
    order,
    history
  };
});

// Order execution endpoint with WebSocket upgrade
app.route({
  method: 'POST',
  url: '/api/orders/execute',
  handler: async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if WebSocket upgrade is requested
    if (request.headers.upgrade === 'websocket') {
      return reply.code(426).send({ 
        error: 'Use GET method for WebSocket upgrade',
        message: 'First POST to create order, then use returned orderId with GET to upgrade to WebSocket'
      });
    }
    
    const orderRequest = request.body as OrderRequest;
    
    // Validate request
    if (!orderRequest.tokenIn || !orderRequest.tokenOut || !orderRequest.amountIn || !orderRequest.walletAddress) {
      return reply.code(400).send({ 
        error: 'Missing required fields: tokenIn, tokenOut, amountIn, walletAddress' 
      });
    }
    
    if (orderRequest.type !== OrderType.MARKET) {
      return reply.code(400).send({ 
        error: 'Only MARKET orders are supported in this version' 
      });
    }
    
    // Create order
    const orderId = uuidv4();
    const order: Order = {
      id: orderId,
      type: orderRequest.type,
      tokenIn: orderRequest.tokenIn,
      tokenOut: orderRequest.tokenOut,
      amountIn: orderRequest.amountIn,
      slippage: orderRequest.slippage ?? config.dex.slippageTolerance,
      walletAddress: orderRequest.walletAddress,
      status: OrderStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save to database
    await database.createOrder(order);
    
    // Add to queue
    await orderQueue.addOrder(order);
    
    app.log.info(`Order ${orderId} created and queued`);
    
    return reply.code(201).send({
      orderId,
      status: 'Order created and queued',
      websocketUrl: `/api/orders/execute/${orderId}`
    });
  },
  wsHandler: (conn, request) => {
    // This shouldn't be called for POST, but keeping for safety
    const connection = conn as unknown as WSConnection;
    connection.send(JSON.stringify({
      error: 'WebSocket not supported on POST /api/orders/execute'
    }));
    connection.socket.close();
  }
});

// WebSocket endpoint for order status updates
app.register(async function (fastify) {
  fastify.get('/api/orders/execute/:orderId', { websocket: true }, (conn, request: FastifyRequest<{ Params: { orderId: string } }>) => {
    const orderId = request.params.orderId;
    
    fastify.log.info(`WebSocket connection established for order ${orderId}`);
    
    let socket: WebSocket;
    // Check if conn is SocketStream (has socket property) or WebSocket itself
    if ((conn as any).socket) {
      socket = (conn as any).socket;
    } else {
      socket = conn as unknown as WebSocket;
    }

    const connection: WSConnection = {
      socket,
      send: (message: string) => socket.send(message)
    };
    
    // Store connection
    connections.set(orderId, connection);
    
    // Send initial connection confirmation
    connection.send(JSON.stringify({
      type: 'connected',
      orderId,
      timestamp: new Date().toISOString()
    }));
    
    // Send current order status
    orderQueue.getOrderStatus(orderId).then(order => {
      if (order) {
        connection.send(JSON.stringify({
          type: 'status',
          orderId: order.id,
          status: order.status,
          timestamp: new Date().toISOString()
        }));
      } else {
        connection.send(JSON.stringify({
          type: 'error',
          error: 'Order not found',
          timestamp: new Date().toISOString()
        }));
        connection.socket.close();
      }
    });
    
    // Handle client messages
    connection.socket.on('message', (message: Buffer) => {
      const data = JSON.parse(message.toString());
      fastify.log.info(`Received message from client for order ${orderId}:`, data);
      
      if (data.type === 'ping') {
        connection.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString()
        }));
      }
    });
    
    // Handle disconnection
    connection.socket.on('close', () => {
      fastify.log.info(`WebSocket connection closed for order ${orderId}`);
      connections.delete(orderId);
    });
    
    // Handle errors
    connection.socket.on('error', (error: Error) => {
      fastify.log.error({ err: error }, `WebSocket error for order ${orderId}`);
      connections.delete(orderId);
    });
  });
});

// Listen for order updates and broadcast to WebSocket clients
orderQueue.on('orderUpdate', (update: OrderStatusUpdate) => {
  const connection = connections.get(update.orderId);
  
  if (connection && connection.socket.readyState === 1) {
    connection.send(JSON.stringify({
      type: 'status',
      orderId: update.orderId,
      status: update.status,
      timestamp: update.timestamp.toISOString(),
      data: update.data
    }));
    
    app.log.info(`Status update sent to WebSocket client for order ${update.orderId}: ${update.status}`);
    
    // Close connection after final status
    if (update.status === OrderStatus.CONFIRMED || update.status === OrderStatus.FAILED) {
      setTimeout(() => {
        if (connection.socket.readyState === 1) {
          connection.send(JSON.stringify({
            type: 'complete',
            orderId: update.orderId,
            timestamp: new Date().toISOString()
          }));
          connection.socket.close();
        }
        connections.delete(update.orderId);
      }, 2000); // Give client 2 seconds to process final status
    }
  }
});

// Graceful shutdown
const gracefulShutdown = async () => {
  app.log.info('Shutting down gracefully...');
  
  // Close all WebSocket connections
  connections.forEach((connection, orderId) => {
    if (connection.socket.readyState === 1) {
      connection.send(JSON.stringify({
        type: 'shutdown',
        message: 'Server is shutting down',
        timestamp: new Date().toISOString()
      }));
      connection.socket.close();
    }
  });
  
  await orderQueue.close();
  await database.close();
  await app.close();
  
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const start = async () => {
  try {
    // Initialize database
    await database.initialize();
    
    // Start server
    await app.listen({
      port: config.server.port,
      host: config.server.host
    });
    
    app.log.info(`Server listening on ${config.server.host}:${config.server.port}`);
    app.log.info(`Environment: ${config.server.env}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
