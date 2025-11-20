import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    host: process.env.HOST ?? '0.0.0.0',
    env: process.env.NODE_ENV ?? 'development'
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? undefined,
    url: process.env.REDIS_URL ?? 'redis://localhost:6379'
  },
  database: {
    url: process.env.DATABASE_URL ?? 'postgresql://user:password@localhost:5432/dex_orders',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'dex_orders',
    user: process.env.DB_USER ?? 'user',
    password: process.env.DB_PASSWORD ?? 'password'
  },
  queue: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_ORDERS ?? '10', 10),
    rateLimit: parseInt(process.env.ORDER_RATE_LIMIT ?? '100', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES ?? '3', 10)
  },
  dex: {
    slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE ?? '0.01'),
    raydiumFee: parseFloat(process.env.RAYDIUM_FEE ?? '0.003'),
    meteoraFee: parseFloat(process.env.METEORA_FEE ?? '0.002')
  }
};
