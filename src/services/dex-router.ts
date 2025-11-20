import { config } from '../config';
import { DexQuote, DexType } from '../types';

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export class DexRouter {
  private readonly basePrice = 1.0; // Base price for token swap
  
  /**
   * Get quote from Raydium DEX
   * Simulates network delay and returns price with variance
   */
  async getRaydiumQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
    // Simulate network delay (150-250ms)
    await sleep(150 + Math.random() * 100);
    
    // Price variance: 98-102% of base price
    const price = this.basePrice * (0.98 + Math.random() * 0.04);
    const amountOut = amount * price;
    const fee = amount * config.dex.raydiumFee;
    const priceImpact = Math.random() * 0.02; // 0-2% price impact
    const estimatedGas = 5000 + Math.floor(Math.random() * 2000); // 5000-7000 lamports
    
    return {
      dex: DexType.RAYDIUM,
      price,
      fee,
      amountOut: amountOut - fee,
      priceImpact,
      estimatedGas
    };
  }
  
  /**
   * Get quote from Meteora DEX
   * Simulates network delay and returns price with different variance
   */
  async getMeteorQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
    // Simulate network delay (150-250ms)
    await sleep(150 + Math.random() * 100);
    
    // Price variance: 97-102% of base price (slightly wider range)
    const price = this.basePrice * (0.97 + Math.random() * 0.05);
    const amountOut = amount * price;
    const fee = amount * config.dex.meteoraFee;
    const priceImpact = Math.random() * 0.025; // 0-2.5% price impact
    const estimatedGas = 4500 + Math.floor(Math.random() * 2000); // 4500-6500 lamports
    
    return {
      dex: DexType.METEORA,
      price,
      fee,
      amountOut: amountOut - fee,
      priceImpact,
      estimatedGas
    };
  }
  
  /**
   * Get quotes from all DEXs in parallel
   */
  async getAllQuotes(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote[]> {
    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amount),
      this.getMeteorQuote(tokenIn, tokenOut, amount)
    ]);
    
    return [raydiumQuote, meteoraQuote];
  }
  
  /**
   * Select best quote based on net output amount
   */
  selectBestQuote(quotes: DexQuote[]): DexQuote {
    if (quotes.length === 0) {
      throw new Error('No quotes available');
    }
    return quotes.reduce((best, current) => {
      const bestNet = best.amountOut - best.estimatedGas;
      const currentNet = current.amountOut - current.estimatedGas;
      return currentNet > bestNet ? current : best;
    }, quotes[0]);
  }
  
  /**
   * Execute swap on selected DEX
   * Simulates transaction execution with realistic delays
   */
  async executeSwap(
    dex: DexType,
    tokenIn: string,
    tokenOut: string,
    amount: number,
    quote: DexQuote,
    slippage: number
  ): Promise<{ txHash: string; executedPrice: number; amountOut: number }> {
    // Simulate transaction building and submission (2-3 seconds)
    await sleep(2000);

    // Simulate wrapping SOL if necessary
    if (tokenIn === 'SOL' || tokenOut === 'SOL') {
      await sleep(500); // Extra delay for wrapping/unwrapping
    }

    // Simulate price movement during delay
    // Random movement between -1% and +1%
    const priceChange = (Math.random() * 0.02) - 0.01;
    const executedPrice = quote.price * (1 + priceChange);

    // Check if price movement exceeds slippage tolerance (only for unfavorable movement)
    // If executed price is lower than minimum acceptable price
    if (executedPrice < quote.price * (1 - slippage)) {
      throw new Error(`Transaction failed: Slippage tolerance exceeded. Price moved from ${quote.price.toFixed(6)} to ${executedPrice.toFixed(6)}`);
    }

    // Calculate final amount out based on executed price
    const amountOut = (amount * executedPrice) - quote.fee;

    return {
      txHash: this.generateMockTxHash(),
      executedPrice,
      amountOut
    };
  }
  
  /**
   * Generate mock Solana transaction hash
   */
  private generateMockTxHash(): string {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let hash = '';
    for (let i = 0; i < 88; i++) {
      hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return hash;
  }
  
  /**
   * Validate order parameters
   */
  validateOrder(tokenIn: string, tokenOut: string, amount: number, slippage: number): void {
    if (!tokenIn || !tokenOut) {
      throw new Error('Invalid token addresses');
    }
    
    if (tokenIn === tokenOut) {
      throw new Error('Cannot swap same token');
    }
    
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    
    if (slippage < 0 || slippage > 1) {
      throw new Error('Slippage must be between 0 and 1');
    }
  }
}

export const dexRouter = new DexRouter();
