import { Job, Queue, Worker } from 'bullmq';
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { config } from '../config';
import { database } from '../db';
import { Order, OrderStatus, OrderStatusUpdate } from '../types';
import { dexRouter } from './dex-router';

export class OrderQueue extends EventEmitter {
  private readonly queue: Queue;
  private readonly worker: Worker;
  private readonly connection: Redis;
  
  constructor() {
    super();
    
    // this.connection = new Redis({
    //   host: config.redis.host,
    //   port: config.redis.port,
    //   password: config.redis.password,
    //   maxRetriesPerRequest: null
    // });
    this.connection = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
  tls: {
    rejectUnauthorized: false
  }
});
    this.queue = new Queue('order-execution', {
      connection: this.connection,
      defaultJobOptions: {
        attempts: config.queue.maxRetries,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: {
          count: 1000,
          age: 24 * 3600
        },
        removeOnFail: {
          count: 5000,
          age: 7 * 24 * 3600
        }
      }
    });
    
    this.worker = new Worker(
      'order-execution',
      async (job: Job) => {
        return this.processOrder(job);
      },
      {
        connection: this.connection,
        concurrency: config.queue.maxConcurrent,
        limiter: {
          max: config.queue.rateLimit,
          duration: 60000 // per minute
        }
      }
    );
    
    this.setupWorkerEvents();
  }
  
  private setupWorkerEvents(): void {
    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });
    
    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err.message);
      if (job) {
        this.emitStatusUpdate({
          orderId: job.data.order.id,
          status: OrderStatus.FAILED,
          timestamp: new Date(),
          data: {
            error: err.message,
            retryAttempt: job.attemptsMade
          }
        });
      }
    });
    
    this.worker.on('error', (err) => {
      console.error('Worker error:', err);
    });
  }
  
  async addOrder(order: Order): Promise<string> {
    const job = await this.queue.add('execute-order', { order }, {
      jobId: order.id
    });
    
    return job.id!;
  }
  
  private async processOrder(job: Job): Promise<void> {
    const { order } = job.data as { order: Order };
    
    try {
      // Update status: PENDING
      await this.updateStatus(order.id, OrderStatus.PENDING, {});
      
      // Validate order
      dexRouter.validateOrder(
        order.tokenIn,
        order.tokenOut,
        order.amountIn,
        order.slippage
      );
      
      // Update status: ROUTING
      await this.updateStatus(order.id, OrderStatus.ROUTING, {});
      
      // Get quotes from all DEXs
      const quotes = await dexRouter.getAllQuotes(
        order.tokenIn,
        order.tokenOut,
        order.amountIn
      );
      
      // Select best quote
      const bestQuote = dexRouter.selectBestQuote(quotes);
      
      console.log(`Order ${order.id}: Best quote from ${bestQuote.dex}`, {
        price: bestQuote.price,
        amountOut: bestQuote.amountOut,
        fee: bestQuote.fee
      });
      
      // Update status with routing decision
      await this.updateStatus(order.id, OrderStatus.ROUTING, {
        quotes,
        selectedQuote: bestQuote,
        dex: bestQuote.dex
      });
      
      // Update status: BUILDING
      await this.updateStatus(order.id, OrderStatus.BUILDING, {
        dex: bestQuote.dex
      });
      
      // Execute swap
      const result = await dexRouter.executeSwap(
        bestQuote.dex,
        order.tokenIn,
        order.tokenOut,
        order.amountIn,
        bestQuote,
        order.slippage
      );
      
      // Update status: SUBMITTED
      await this.updateStatus(order.id, OrderStatus.SUBMITTED, {
        dex: bestQuote.dex,
        txHash: result.txHash
      });
      
      // Simulate confirmation delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update status: CONFIRMED
      await this.updateStatus(order.id, OrderStatus.CONFIRMED, {
        dex: bestQuote.dex,
        txHash: result.txHash,
        executedPrice: result.executedPrice,
        amountOut: result.amountOut
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`Order ${order.id} processing error:`, errorMessage);
      
      // Update status: FAILED
      await this.updateStatus(order.id, OrderStatus.FAILED, {
        error: errorMessage,
        retryAttempt: job.attemptsMade
      });
      
      throw error; // Re-throw to trigger retry mechanism
    }
  }
  
  private async updateStatus(
    orderId: string,
    status: OrderStatus,
    data: OrderStatusUpdate['data']
  ): Promise<void> {
    const update: OrderStatusUpdate = {
      orderId,
      status,
      timestamp: new Date(),
      data
    };
    
    // Update database
    await database.updateOrderStatus(orderId, status);
    await database.addOrderHistory(update);
    
    // Emit event for WebSocket
    this.emitStatusUpdate(update);
  }
  
  private emitStatusUpdate(update: OrderStatusUpdate): void {
    this.emit('orderUpdate', update);
  }
  
  async getOrderStatus(orderId: string): Promise<Order | null> {
    return database.getOrder(orderId);
  }
  
  async getOrderHistory(orderId: string): Promise<OrderStatusUpdate[]> {
    return database.getOrderHistory(orderId);
  }
  
  async close(): Promise<void> {
    await this.queue.close();
    await this.worker.close();
    await this.connection.quit();
  }
}

export const orderQueue = new OrderQueue();
