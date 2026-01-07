/**
 * App Configuration Tests
 * 
 * Tests to validate app.config.json settings
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

interface AppConfig {
  environmentUrl: string;
  app: {
    name: string;
    version: string;
    description: string;
    id: string;
    scopes: Array<{ name: string; comment?: string }>;
  };
}

describe('App Configuration', () => {
  let config: AppConfig;

  beforeAll(() => {
    const configPath = path.resolve(__dirname, '../../../app.config.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configContent);
  });

  describe('App Metadata', () => {
    it('should have a valid app name', () => {
      expect(config.app.name).toBeDefined();
      expect(config.app.name.length).toBeGreaterThan(0);
    });

    it('should have a valid app ID', () => {
      expect(config.app.id).toBeDefined();
      expect(config.app.id).toMatch(/^my\.\w+/);
    });

    it('should have a semantic version', () => {
      expect(config.app.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('OAuth Scopes', () => {
    const requiredScopes = [
      'storage:spans:read',
      'storage:logs:read',
      'storage:buckets:read',
    ];

    const recommendedScopes = [
      'storage:events:read',
      'storage:metrics:read',
    ];

    it('should have storage:spans:read scope (required for GenAI data)', () => {
      const scopeNames = config.app.scopes.map(s => s.name);
      expect(scopeNames).toContain('storage:spans:read');
    });

    it('should have storage:logs:read scope', () => {
      const scopeNames = config.app.scopes.map(s => s.name);
      expect(scopeNames).toContain('storage:logs:read');
    });

    it('should have storage:buckets:read scope', () => {
      const scopeNames = config.app.scopes.map(s => s.name);
      expect(scopeNames).toContain('storage:buckets:read');
    });

    it('should have all required scopes', () => {
      const scopeNames = config.app.scopes.map(s => s.name);
      requiredScopes.forEach(scope => {
        expect(scopeNames).toContain(scope);
      });
    });

    it('should have recommended scopes for full functionality', () => {
      const scopeNames = config.app.scopes.map(s => s.name);
      recommendedScopes.forEach(scope => {
        expect(scopeNames).toContain(scope);
      });
    });
  });

  describe('Environment Configuration', () => {
    it('should have a valid environment URL', () => {
      expect(config.environmentUrl).toBeDefined();
      expect(config.environmentUrl).toMatch(/^https:\/\/.+\.apps\.dynatrace\.com\/?$/);
    });
  });
});
