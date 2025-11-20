export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  SNIPER = 'sniper'
}

export enum OrderStatus {
  PENDING = 'pending',
  ROUTING = 'routing',
  BUILDING = 'building',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed'
}

export enum DexType {
  RAYDIUM = 'raydium',
  METEORA = 'meteora'
}

export interface Order {
  id: string;
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippage: number;
  walletAddress: string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderRequest {
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippage?: number;
  walletAddress: string;
}

export interface DexQuote {
  dex: DexType;
  price: number;
  fee: number;
  amountOut: number;
  priceImpact: number;
  estimatedGas: number;
}

export interface ExecutionResult {
  orderId: string;
  dex: DexType;
  txHash: string;
  executedPrice: number;
  amountIn: number;
  amountOut: number;
  fee: number;
  timestamp: Date;
}

export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  timestamp: Date;
  data?: {
    dex?: DexType;
    txHash?: string;
    executedPrice?: number;
    amountOut?: number;
    error?: string;
    retryAttempt?: number;
    quotes?: DexQuote[];
    selectedQuote?: DexQuote;
  };
}

export interface OrderHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  data: Record<string, any>;
  createdAt: Date;
}
