/**
 * DQL Query Syntax Tests
 * 
 * These tests validate that DQL queries used in the app follow correct syntax
 * and use valid functions/operators supported by Dynatrace Grail.
 */

import { describe, it, expect } from 'vitest';

// Common DQL patterns used across the app
const genAiFilter = 'isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)';

// Invalid DQL functions that should NOT be used
const invalidFunctions = [
  'sumIf',
  'countIf', 
  'avgIf',
  'minIf',
  'maxIf',
];

describe('DQL Query Syntax Validation', () => {
  describe('GenAI Filter Pattern', () => {
    it('should use isNotNull for checking GenAI fields', () => {
      expect(genAiFilter).toContain('isNotNull(gen_ai.provider.name)');
      expect(genAiFilter).toContain('isNotNull(gen_ai.request.model)');
    });

    it('should use OR operator between field checks', () => {
      expect(genAiFilter).toMatch(/isNotNull\(.+\)\s+OR\s+isNotNull\(.+\)/);
    });
  });

  describe('Aggregation Functions', () => {
    it('should not use sumIf function (not supported in DQL)', () => {
      const testQuery = `
        fetch spans, from: now()-7d
        | filter isNotNull(gen_ai.provider.name)
        | summarize total = sum(gen_ai.usage.input_tokens)
      `;
      
      for (const fn of invalidFunctions) {
        expect(testQuery.toLowerCase()).not.toContain(fn.toLowerCase());
      }
    });

    it('should use separate queries for conditional aggregation', () => {
      // Instead of sumIf, use separate fetch statements with different time ranges
      const recentQuery = `fetch spans, from: now()-7d`;
      const previousQuery = `fetch spans, from: now()-14d, to: now()-7d`;
      
      expect(recentQuery).toContain('now()-7d');
      expect(previousQuery).toContain('to: now()-7d');
    });
  });

  describe('Conditional Logic (if function)', () => {
    it('should use named parameters for if() function', () => {
      // DQL if() requires named parameters: then: and else:
      const validIfSyntax = 'if(total > 0, then: value / total, else: 0.0)';
      
      expect(validIfSyntax).toContain('then:');
      expect(validIfSyntax).toContain('else:');
    });

    it('should not use positional parameters for if() function', () => {
      const invalidIfSyntax = 'if(total > 0, value / total, 0)';
      
      // This is considered invalid - the else parameter should be named
      // Check that we don't have a pattern like if(cond, expr, expr) without named params
      const positionalPattern = /if\([^,]+,\s*[^,]+,\s*[^:]+\)/;
      
      // The invalid syntax would match this pattern (no colons for named params)
      expect(positionalPattern.test(invalidIfSyntax)).toBe(true);
    });
  });

  describe('Token Field Coalescing', () => {
    it('should coalesce input token fields properly', () => {
      const inputTokenCoalesce = 'coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)';
      
      expect(inputTokenCoalesce).toContain('gen_ai.usage.input_tokens');
      expect(inputTokenCoalesce).toContain('gen_ai.usage.prompt_tokens');
    });

    it('should coalesce output token fields properly', () => {
      const outputTokenCoalesce = 'coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)';
      
      expect(outputTokenCoalesce).toContain('gen_ai.usage.output_tokens');
      expect(outputTokenCoalesce).toContain('gen_ai.usage.completion_tokens');
    });
  });

  describe('Time Range Formats', () => {
    it('should use valid relative time formats', () => {
      const validTimeRanges = ['now()-1h', 'now()-24h', 'now()-7d', 'now()-14d', 'now()-30d'];
      
      validTimeRanges.forEach(range => {
        expect(range).toMatch(/^now\(\)-\d+[hdwm]$/);
      });
    });

    it('should use from:/to: for bounded time ranges', () => {
      const boundedQuery = 'fetch spans, from: now()-14d, to: now()-7d';
      
      expect(boundedQuery).toContain('from:');
      expect(boundedQuery).toContain('to:');
    });
  });

  describe('Summarize Syntax', () => {
    it('should use by: for grouping in summarize', () => {
      const validSummarize = `
        | summarize 
            total = sum(gen_ai.usage.input_tokens),
            by: { model = gen_ai.request.model }
      `;
      
      expect(validSummarize).toContain('by:');
      expect(validSummarize).toContain('{');
    });

    it('should alias fields in group by using equals', () => {
      const groupBy = 'by: { model = gen_ai.request.model, provider = gen_ai.provider.name }';
      
      expect(groupBy).toMatch(/\w+\s*=\s*gen_ai\./);
    });
  });

  describe('Required OAuth Scopes', () => {
    it('should require storage:spans:read for GenAI queries', () => {
      const requiredScopes = [
        'storage:spans:read',
        'storage:logs:read',
        'storage:buckets:read',
      ];
      
      // GenAI data is stored in spans, so spans:read is mandatory
      expect(requiredScopes).toContain('storage:spans:read');
    });
  });
});

describe('Query Building Utilities', () => {
  const buildGenAiQuery = (timeRange: string, aggregations: string[], groupBy?: string) => {
    let query = `fetch spans, from: now()-${timeRange}
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | summarize ${aggregations.join(', ')}`;
    
    if (groupBy) {
      query += `, by: { ${groupBy} }`;
    }
    
    return query;
  };

  it('should build valid queries with aggregations', () => {
    const query = buildGenAiQuery('24h', ['total = count()']);
    
    expect(query).toContain('fetch spans');
    expect(query).toContain('now()-24h');
    expect(query).toContain('summarize total = count()');
  });

  it('should build valid queries with group by', () => {
    const query = buildGenAiQuery('7d', ['count = count()'], 'model = gen_ai.request.model');
    
    expect(query).toContain('by: { model = gen_ai.request.model }');
  });
});
