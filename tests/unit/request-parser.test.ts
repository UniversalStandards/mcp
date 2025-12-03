import { describe, test, expect } from '@jest/globals';
import { parseIncoming, validateMethod, createErrorResponse, createSuccessResponse } from '../../src/normalizer/request-parser';

describe('Request Parser', () => {
  describe('parseIncoming', () => {
    test('should parse valid JSON-RPC 2.0 request', () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'test_tool' }
      };

      const result = parseIncoming(request);

      expect(result.jsonrpc).toBe('2.0');
      expect(result.id).toBe(1);
      expect(result.method).toBe('tools/call');
      expect(result.params).toEqual({ name: 'test_tool' });
      expect(result.isValid).toBe(true);
    });

    test('should handle missing jsonrpc field', () => {
      const request = {
        id: 1,
        method: 'tools/call',
        params: {}
      };

      const result = parseIncoming(request);

      expect(result.jsonrpc).toBe('2.0');
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain('Missing jsonrpc field, defaulting to "2.0"');
    });

    test('should handle missing method field', () => {
      const request = {
        jsonrpc: '2.0',
        id: 1
      };

      const result = parseIncoming(request);

      expect(result.method).toBe('tools/call');
      expect(result.isValid).toBe(false);
    });

    test('should generate id if missing', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list'
      };

      const result = parseIncoming(request);

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
    });

    test('should handle completely invalid input', () => {
      const result = parseIncoming({ random: 'data' });

      expect(result.jsonrpc).toBe('2.0');
      expect(result.method).toBe('tools/call');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateMethod', () => {
    test('should validate known methods', () => {
      expect(validateMethod('tools/call')).toBe(true);
      expect(validateMethod('tools/list')).toBe(true);
      expect(validateMethod('resources/read')).toBe(true);
      expect(validateMethod('resources/list')).toBe(true);
      expect(validateMethod('prompts/get')).toBe(true);
      expect(validateMethod('ping')).toBe(true);
    });

    test('should reject unknown methods', () => {
      expect(validateMethod('unknown/method')).toBe(false);
      expect(validateMethod('invalid')).toBe(false);
      expect(validateMethod('')).toBe(false);
    });
  });

  describe('Response Creation', () => {
    test('should create error response', () => {
      const response = createErrorResponse(1, -32600, 'Invalid Request');

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      });
    });

    test('should create success response', () => {
      const result = { data: 'test' };
      const response = createSuccessResponse(1, result);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { data: 'test' }
      });
    });
  });
});
