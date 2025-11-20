import { Queue, Worker } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { OrderQueue } from '../services/order-queue';
import { Order, OrderStatus, OrderType } from '../types';

// Mock dependencies
jest.mock('bullmq');
jest.mock('../db', () => ({
  database: {
    createOrder: jest.fn(),
    updateOrderStatus: jest.fn(),
    addOrderHistory: jest.fn(),
    getOrder: jest.fn(),
    getOrderHistory: jest.fn()
  }
}));

jest.mock('../services/dex-router', () => ({
  dexRouter: {
    validateOrder: jest.fn(),
    getAllQuotes: jest.fn().mockResolvedValue([
      {
        dex: 'raydium',
        price: 1.0,
        fee: 0.3,
        amountOut: 99.7,
        priceImpact: 0.01,
        estimatedGas: 5000
      },
      {
        dex: 'meteora',
        price: 1.02,
        fee: 0.2,
        amountOut: 101.8,
        priceImpact: 0.008,
        estimatedGas: 4500
      }
    ]),
    selectBestQuote: jest.fn().mockReturnValue({
      dex: 'meteora',
      price: 1.02,
      fee: 0.2,
      amountOut: 101.8,
      priceImpact: 0.008,
      estimatedGas: 4500
    }),
    executeSwap: jest.fn().mockResolvedValue({
      txHash: 'mock-tx-hash-123456789',
      executedPrice: 1.015,
      amountOut: 101.3
    })
  }
}));

describe('OrderQueue', () => {
  let queue: OrderQueue;
  let mockOrder: Order;
  let workerProcessor: any;
  
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock BullMQ implementations
    (Queue as unknown as jest.Mock).mockImplementation(() => ({
      add: jest.fn().mockImplementation((name, data, opts) => Promise.resolve({ id: opts.jobId })),
      close: jest.fn(),
      on: jest.fn(),
    }));

    (Worker as unknown as jest.Mock).mockImplementation((name, processor) => {
      workerProcessor = processor;
      return {
        close: jest.fn(),
        on: jest.fn(),
      };
    });
    
    mockOrder = {
      id: uuidv4(),
      type: OrderType.MARKET,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: 100,
      slippage: 0.01,
      walletAddress: '0x123456789',
      status: OrderStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });
  
  afterEach(async () => {
    if (queue) {
      await queue.close();
      // Wait a bit for connections to fully close
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });

  afterAll(async () => {
    // Ensure all connections are closed
    await new Promise(resolve => setTimeout(resolve, 500));
  });
  
  describe('addOrder', () => {
    it('should add order to queue and return job id', async () => {
      queue = new OrderQueue();
      const jobId = await queue.addOrder(mockOrder);
      
      expect(jobId).toBe(mockOrder.id);
    });
  });
  
  describe('order processing', () => {
    it('should emit status updates during processing', async () => {
      queue = new OrderQueue();
      
      const statusUpdates: string[] = [];
      
      const completePromise = new Promise<void>((resolve) => {
        queue.on('orderUpdate', (update) => {
          statusUpdates.push(update.status);
          
          // Check if we've received all expected statuses
          if (update.status === OrderStatus.CONFIRMED) {
            expect(statusUpdates).toContain(OrderStatus.PENDING);
            expect(statusUpdates).toContain(OrderStatus.ROUTING);
            expect(statusUpdates).toContain(OrderStatus.BUILDING);
            expect(statusUpdates).toContain(OrderStatus.SUBMITTED);
            expect(statusUpdates).toContain(OrderStatus.CONFIRMED);
            resolve();
          }
        });
      });
      
      await queue.addOrder(mockOrder);
      
      // Manually trigger worker processing
      if (workerProcessor) {
        await workerProcessor({ data: { order: mockOrder }, id: mockOrder.id });
      }

      await completePromise;
    }, 20000); // Increase timeout for processing
    
    it('should select best DEX based on quotes', async () => {
      queue = new OrderQueue();
      
      const completePromise = new Promise<void>((resolve) => {
        queue.on('orderUpdate', (update) => {
          console.log('Test received update:', update.status, 'dex:', update.data?.dex);
          if (update.data?.dex) {
            expect(['raydium', 'meteora']).toContain(update.data.dex);
            resolve();
          }
        });
      });
      
      await queue.addOrder(mockOrder);
      
      // Manually trigger worker processing
      if (workerProcessor) {
        await workerProcessor({ data: { order: mockOrder }, id: mockOrder.id });
      }

      await completePromise;
    }, 30000);
  });
  
  describe('error handling', () => {
    it('should emit failed status on error', async () => {
      const { dexRouter } = require('../services/dex-router');
      dexRouter.validateOrder.mockImplementationOnce(() => {
        throw new Error('Validation failed');
      });
      
      queue = new OrderQueue();
      
      const completePromise = new Promise<void>((resolve) => {
        queue.on('orderUpdate', (update) => {
          if (update.status === OrderStatus.FAILED) {
            expect(update.data?.error).toBe('Validation failed');
            resolve();
          }
        });
      });
      
      await queue.addOrder(mockOrder);
      
      // Manually trigger worker processing
      if (workerProcessor) {
        try {
          await workerProcessor({ data: { order: mockOrder }, id: mockOrder.id });
        } catch (e) {
          // Expected error
        }
      }

      await completePromise;
    }, 20000);
  });
  
  describe('concurrent processing', () => {
    it('should process multiple orders concurrently', async () => {
      queue = new OrderQueue();
      
      const orders = Array.from({ length: 5 }, () => ({
        ...mockOrder,
        id: uuidv4()
      }));
      
      const startTime = Date.now();
      const jobIds = await Promise.all(orders.map(order => queue.addOrder(order)));
      const endTime = Date.now();
      
      expect(jobIds).toHaveLength(5);
      expect(endTime - startTime).toBeLessThan(1000); // Should queue quickly
    });
  });
  
  describe('getOrderStatus', () => {
    it('should retrieve order from database', async () => {
      const { database } = require('../db');
      database.getOrder.mockResolvedValue(mockOrder);
      
      queue = new OrderQueue();
      const order = await queue.getOrderStatus(mockOrder.id);
      
      expect(database.getOrder).toHaveBeenCalledWith(mockOrder.id);
      expect(order).toEqual(mockOrder);
    });
  });
  
  describe('getOrderHistory', () => {
    it('should retrieve order history from database', async () => {
      const { database } = require('../db');
      const mockHistory = [
        {
          orderId: mockOrder.id,
          status: OrderStatus.PENDING,
          timestamp: new Date(),
          data: {}
        },
        {
          orderId: mockOrder.id,
          status: OrderStatus.CONFIRMED,
          timestamp: new Date(),
          data: { txHash: 'abc123' }
        }
      ];
      
      database.getOrderHistory.mockResolvedValue(mockHistory);
      
      queue = new OrderQueue();
      const history = await queue.getOrderHistory(mockOrder.id);
      
      expect(database.getOrderHistory).toHaveBeenCalledWith(mockOrder.id);
      expect(history).toEqual(mockHistory);
    });
  });
});
