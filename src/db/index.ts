import { Pool } from 'pg';
import { config } from '../config';
import { Order, OrderStatus, OrderStatusUpdate } from '../types';

export class Database {
  private readonly pool: Pool;
  
  constructor() {
    // this.pool = new Pool({
    //   host: config.database.host,
    //   port: config.database.port,
    //   database: config.database.database,
    //   user: config.database.user,
    //   password: config.database.password,
    //   max: 20,
    //   idleTimeoutMillis: 30000,
    //   connectionTimeoutMillis: 2000
    // });
    
    this.pool = new Pool({
        connectionString: config.database.url,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
    });



    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });
  }
  
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id VARCHAR(36) PRIMARY KEY,
          type VARCHAR(20) NOT NULL,
          token_in VARCHAR(100) NOT NULL,
          token_out VARCHAR(100) NOT NULL,
          amount_in DECIMAL NOT NULL,
          slippage DECIMAL NOT NULL,
          wallet_address VARCHAR(100) NOT NULL,
          status VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS order_history (
          id SERIAL PRIMARY KEY,
          order_id VARCHAR(36) NOT NULL,
          status VARCHAR(20) NOT NULL,
          data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders(id)
        )
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id)
      `);
      
      console.log('Database initialized successfully');
    } finally {
      client.release();
    }
  }
  
  async createOrder(order: Order): Promise<void> {
    const query = `
      INSERT INTO orders (id, type, token_in, token_out, amount_in, slippage, wallet_address, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    
    await this.pool.query(query, [
      order.id,
      order.type,
      order.tokenIn,
      order.tokenOut,
      order.amountIn,
      order.slippage,
      order.walletAddress,
      order.status,
      order.createdAt,
      order.updatedAt
    ]);
  }
  
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    const query = `
      UPDATE orders
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    
    await this.pool.query(query, [status, orderId]);
  }
  
  async getOrder(orderId: string): Promise<Order | null> {
    const query = `SELECT * FROM orders WHERE id = $1`;
    const result = await this.pool.query(query, [orderId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      type: row.type,
      tokenIn: row.token_in,
      tokenOut: row.token_out,
      amountIn: parseFloat(row.amount_in),
      slippage: parseFloat(row.slippage),
      walletAddress: row.wallet_address,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  
  async addOrderHistory(update: OrderStatusUpdate): Promise<void> {
    const query = `
      INSERT INTO order_history (order_id, status, data)
      VALUES ($1, $2, $3)
    `;
    
    await this.pool.query(query, [
      update.orderId,
      update.status,
      JSON.stringify(update.data || {})
    ]);
  }
  
  async getOrderHistory(orderId: string): Promise<OrderStatusUpdate[]> {
    const query = `
      SELECT * FROM order_history
      WHERE order_id = $1
      ORDER BY created_at ASC
    `;
    
    const result = await this.pool.query(query, [orderId]);
    
    return result.rows.map(row => ({
      orderId: row.order_id,
      status: row.status,
      timestamp: row.created_at,
      data: row.data
    }));
  }
  
  async getRecentOrders(limit: number = 100): Promise<Order[]> {
    const query = `
      SELECT * FROM orders
      ORDER BY created_at DESC
      LIMIT $1
    `;
    
    const result = await this.pool.query(query, [limit]);
    
    return result.rows.map(row => ({
      id: row.id,
      type: row.type,
      tokenIn: row.token_in,
      tokenOut: row.token_out,
      amountIn: parseFloat(row.amount_in),
      slippage: parseFloat(row.slippage),
      walletAddress: row.wallet_address,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
  
  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const database = new Database();
