/**
 * Cost Estimation Utility Tests
 * 
 * Tests for the cost calculation logic used across the app
 */

import { describe, it, expect } from 'vitest';

// Cost estimation function (extracted from app logic)
const estimateCost = (model: string, inputTokens: number, outputTokens: number): number => {
  const m = (model || '').toLowerCase();
  let inputRate = 0.001 / 1000; // Default rate
  let outputRate = 0.002 / 1000;

  if (m.includes('gpt-4o')) {
    inputRate = 0.0025 / 1000;
    outputRate = 0.01 / 1000;
  } else if (m.includes('gpt-4')) {
    inputRate = 0.03 / 1000;
    outputRate = 0.06 / 1000;
  } else if (m.includes('gpt-3')) {
    inputRate = 0.0005 / 1000;
    outputRate = 0.0015 / 1000;
  } else if (m.includes('claude-3-opus')) {
    inputRate = 0.015 / 1000;
    outputRate = 0.075 / 1000;
  } else if (m.includes('claude-3-sonnet') || m.includes('claude-3.5-sonnet')) {
    inputRate = 0.003 / 1000;
    outputRate = 0.015 / 1000;
  } else if (m.includes('claude')) {
    inputRate = 0.008 / 1000;
    outputRate = 0.024 / 1000;
  }

  return inputTokens * inputRate + outputTokens * outputRate;
};

describe('Cost Estimation', () => {
  describe('GPT-4o Model', () => {
    it('should calculate cost for GPT-4o correctly', () => {
      const cost = estimateCost('gpt-4o', 1000, 500);
      // Input: 1000 * 0.0025/1000 = 0.0025
      // Output: 500 * 0.01/1000 = 0.005
      expect(cost).toBeCloseTo(0.0075, 6);
    });

    it('should handle case-insensitive model names', () => {
      const cost1 = estimateCost('GPT-4o', 1000, 1000);
      const cost2 = estimateCost('gpt-4o', 1000, 1000);
      expect(cost1).toBe(cost2);
    });
  });

  describe('GPT-4 Model', () => {
    it('should calculate cost for GPT-4 correctly', () => {
      const cost = estimateCost('gpt-4', 1000, 500);
      // Input: 1000 * 0.03/1000 = 0.03
      // Output: 500 * 0.06/1000 = 0.03
      expect(cost).toBeCloseTo(0.06, 6);
    });

    it('should use GPT-4 rates for gpt-4-turbo', () => {
      const cost = estimateCost('gpt-4-turbo', 1000, 500);
      expect(cost).toBeCloseTo(0.06, 6);
    });
  });

  describe('GPT-3.5 Model', () => {
    it('should calculate cost for GPT-3.5 correctly', () => {
      const cost = estimateCost('gpt-3.5-turbo', 1000, 500);
      // Input: 1000 * 0.0005/1000 = 0.0005
      // Output: 500 * 0.0015/1000 = 0.00075
      expect(cost).toBeCloseTo(0.00125, 6);
    });
  });

  describe('Claude Models', () => {
    it('should calculate cost for Claude-3-Opus correctly', () => {
      const cost = estimateCost('claude-3-opus', 1000, 500);
      // Input: 1000 * 0.015/1000 = 0.015
      // Output: 500 * 0.075/1000 = 0.0375
      expect(cost).toBeCloseTo(0.0525, 6);
    });

    it('should calculate cost for Claude-3-Sonnet correctly', () => {
      const cost = estimateCost('claude-3-sonnet', 1000, 500);
      // Input: 1000 * 0.003/1000 = 0.003
      // Output: 500 * 0.015/1000 = 0.0075
      expect(cost).toBeCloseTo(0.0105, 6);
    });

    it('should calculate cost for Claude-3.5-Sonnet correctly', () => {
      const cost = estimateCost('claude-3.5-sonnet', 1000, 500);
      expect(cost).toBeCloseTo(0.0105, 6);
    });
  });

  describe('Unknown Models', () => {
    it('should use default rates for unknown models', () => {
      const cost = estimateCost('unknown-model', 1000, 500);
      // Input: 1000 * 0.001/1000 = 0.001
      // Output: 500 * 0.002/1000 = 0.001
      expect(cost).toBeCloseTo(0.002, 6);
    });

    it('should handle empty model name', () => {
      const cost = estimateCost('', 1000, 500);
      expect(cost).toBeCloseTo(0.002, 6);
    });

    it('should handle null model name', () => {
      const cost = estimateCost(null as unknown as string, 1000, 500);
      expect(cost).toBeCloseTo(0.002, 6);
    });
  });

  describe('Edge Cases', () => {
    it('should return 0 for zero tokens', () => {
      const cost = estimateCost('gpt-4', 0, 0);
      expect(cost).toBe(0);
    });

    it('should handle large token counts', () => {
      const cost = estimateCost('gpt-4', 1000000, 500000);
      // Input: 1000000 * 0.03/1000 = 30
      // Output: 500000 * 0.06/1000 = 30
      expect(cost).toBeCloseTo(60, 2);
    });

    it('should handle only input tokens', () => {
      const cost = estimateCost('gpt-4', 1000, 0);
      expect(cost).toBeCloseTo(0.03, 6);
    });

    it('should handle only output tokens', () => {
      const cost = estimateCost('gpt-4', 0, 1000);
      expect(cost).toBeCloseTo(0.06, 6);
    });
  });
});

describe('Token Calculations', () => {
  const calculateTotalTokens = (input: number, output: number): number => {
    return input + output;
  };

  const calculateGrowthRate = (recent: number, previous: number): number => {
    if (previous <= 0) return 0;
    return ((recent - previous) / previous) * 100;
  };

  describe('Total Token Calculation', () => {
    it('should sum input and output tokens', () => {
      expect(calculateTotalTokens(1000, 500)).toBe(1500);
    });

    it('should handle zero values', () => {
      expect(calculateTotalTokens(0, 0)).toBe(0);
    });
  });

  describe('Growth Rate Calculation', () => {
    it('should calculate positive growth correctly', () => {
      const rate = calculateGrowthRate(1200, 1000);
      expect(rate).toBe(20); // 20% growth
    });

    it('should calculate negative growth correctly', () => {
      const rate = calculateGrowthRate(800, 1000);
      expect(rate).toBe(-20); // -20% growth
    });

    it('should return 0 for zero previous tokens', () => {
      const rate = calculateGrowthRate(1000, 0);
      expect(rate).toBe(0);
    });

    it('should handle equal values', () => {
      const rate = calculateGrowthRate(1000, 1000);
      expect(rate).toBe(0);
    });
  });
});
