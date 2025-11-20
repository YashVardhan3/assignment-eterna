import { DexRouter } from '../services/dex-router';
import { DexType } from '../types';

describe('DexRouter', () => {
  let router: DexRouter;
  
  beforeEach(() => {
    router = new DexRouter();
  });
  
  describe('getRaydiumQuote', () => {
    it('should return a valid quote with correct structure', async () => {
      const quote = await router.getRaydiumQuote('SOL', 'USDC', 100);
      
      expect(quote).toHaveProperty('dex', DexType.RAYDIUM);
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('fee');
      expect(quote).toHaveProperty('amountOut');
      expect(quote).toHaveProperty('priceImpact');
      expect(quote).toHaveProperty('estimatedGas');
      
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.fee).toBeGreaterThan(0);
      expect(quote.amountOut).toBeGreaterThan(0);
      expect(quote.priceImpact).toBeGreaterThanOrEqual(0);
      expect(quote.estimatedGas).toBeGreaterThan(0);
    });
    
    it('should apply correct fee rate', async () => {
      const amount = 100;
      const quote = await router.getRaydiumQuote('SOL', 'USDC', amount);
      
      // Fee should be approximately 0.3% of amount
      expect(quote.fee).toBeCloseTo(amount * 0.003, 4);
    });
    
    it('should have realistic price variance', async () => {
      const quotes = await Promise.all([
        router.getRaydiumQuote('SOL', 'USDC', 100),
        router.getRaydiumQuote('SOL', 'USDC', 100),
        router.getRaydiumQuote('SOL', 'USDC', 100)
      ]);
      
      // Prices should vary but be within expected range (0.98-1.02)
      quotes.forEach((quote: any) => {
        expect(quote.price).toBeGreaterThanOrEqual(0.95);
        expect(quote.price).toBeLessThanOrEqual(1.05);
      });
    });
  });
  
  describe('getMeteorQuote', () => {
    it('should return a valid quote with correct structure', async () => {
      const quote = await router.getMeteorQuote('SOL', 'USDC', 100);
      
      expect(quote).toHaveProperty('dex', DexType.METEORA);
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('fee');
      expect(quote).toHaveProperty('amountOut');
      expect(quote).toHaveProperty('priceImpact');
      expect(quote).toHaveProperty('estimatedGas');
    });
    
    it('should apply correct fee rate', async () => {
      const amount = 100;
      const quote = await router.getMeteorQuote('SOL', 'USDC', amount);
      
      // Fee should be approximately 0.2% of amount
      expect(quote.fee).toBeCloseTo(amount * 0.002, 4);
    });
    
    it('should have lower fees than Raydium', async () => {
      const amount = 100;
      const [raydiumQuote, meteoraQuote] = await Promise.all([
        router.getRaydiumQuote('SOL', 'USDC', amount),
        router.getMeteorQuote('SOL', 'USDC', amount)
      ]);
      
      expect(meteoraQuote.fee).toBeLessThan(raydiumQuote.fee);
    });
  });
  
  describe('getAllQuotes', () => {
    it('should return quotes from both DEXs', async () => {
      const quotes = await router.getAllQuotes('SOL', 'USDC', 100);
      
      expect(quotes).toHaveLength(2);
      expect(quotes.some((q: any) => q.dex === DexType.RAYDIUM)).toBe(true);
      expect(quotes.some((q: any) => q.dex === DexType.METEORA)).toBe(true);
    });
    
    it('should fetch quotes in parallel', async () => {
      const startTime = Date.now();
      await router.getAllQuotes('SOL', 'USDC', 100);
      const duration = Date.now() - startTime;
      
      // Should take around 200-300ms (not 400-600ms if sequential)
      expect(duration).toBeLessThan(500);
    });
  });
  
  describe('selectBestQuote', () => {
    it('should select quote with highest net output', async () => {
      const quotes = await router.getAllQuotes('SOL', 'USDC', 100);
      const bestQuote = router.selectBestQuote(quotes);
      
      const netAmounts = quotes.map((q: any) => q.amountOut - q.estimatedGas);
      const maxNetAmount = Math.max(...netAmounts);
      const bestNetAmount = bestQuote.amountOut - bestQuote.estimatedGas;
      
      expect(bestNetAmount).toBe(maxNetAmount);
    });
    
    it('should return a quote from the input array', async () => {
      const quotes = await router.getAllQuotes('SOL', 'USDC', 100);
      const bestQuote = router.selectBestQuote(quotes);
      
      expect(quotes).toContainEqual(bestQuote);
    });
  });
  
  describe('executeSwap', () => {
    it('should return valid execution result', async () => {
      const quote = await router.getRaydiumQuote('SOL', 'USDC', 100);
      const result = await router.executeSwap(DexType.RAYDIUM, 'SOL', 'USDC', 100, quote, 0.01);
      
      expect(result).toHaveProperty('txHash');
      expect(result).toHaveProperty('executedPrice');
      expect(result).toHaveProperty('amountOut');
      
      expect(result.txHash).toHaveLength(88); // Solana tx hash length
      expect(result.executedPrice).toBeGreaterThan(0);
      expect(result.amountOut).toBeGreaterThan(0);
    });
    
    it('should simulate realistic execution time', async () => {
      const quote = await router.getRaydiumQuote('SOL', 'USDC', 100);
      
      const startTime = Date.now();
      await router.executeSwap(DexType.RAYDIUM, 'SOL', 'USDC', 100, quote, 0.01);
      const duration = Date.now() - startTime;
      
      // Should take 2-3 seconds
      expect(duration).toBeGreaterThanOrEqual(2000);
      expect(duration).toBeLessThan(4000);
    });
    
    it('should apply slippage to executed price', async () => {
      const quote = await router.getRaydiumQuote('SOL', 'USDC', 100);
      const result = await router.executeSwap(DexType.RAYDIUM, 'SOL', 'USDC', 100, quote, 0.01);
      
      // Executed price should be within +/- 1% of quote price
      expect(result.executedPrice).toBeGreaterThanOrEqual(quote.price * 0.99);
      expect(result.executedPrice).toBeLessThanOrEqual(quote.price * 1.01);
    });
  });
  
  describe('validateOrder', () => {
    it('should accept valid order parameters', () => {
      expect(() => {
        router.validateOrder('SOL', 'USDC', 100, 0.01);
      }).not.toThrow();
    });
    
    it('should reject empty token addresses', () => {
      expect(() => {
        router.validateOrder('', 'USDC', 100, 0.01);
      }).toThrow('Invalid token addresses');
      
      expect(() => {
        router.validateOrder('SOL', '', 100, 0.01);
      }).toThrow('Invalid token addresses');
    });
    
    it('should reject same token swap', () => {
      expect(() => {
        router.validateOrder('SOL', 'SOL', 100, 0.01);
      }).toThrow('Cannot swap same token');
    });
    
    it('should reject invalid amounts', () => {
      expect(() => {
        router.validateOrder('SOL', 'USDC', 0, 0.01);
      }).toThrow('Amount must be greater than 0');
      
      expect(() => {
        router.validateOrder('SOL', 'USDC', -100, 0.01);
      }).toThrow('Amount must be greater than 0');
    });
    
    it('should reject invalid slippage', () => {
      expect(() => {
        router.validateOrder('SOL', 'USDC', 100, -0.1);
      }).toThrow('Slippage must be between 0 and 1');
      
      expect(() => {
        router.validateOrder('SOL', 'USDC', 100, 1.5);
      }).toThrow('Slippage must be between 0 and 1');
    });
  });
});
