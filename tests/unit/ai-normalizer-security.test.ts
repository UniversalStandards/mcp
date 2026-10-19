import { afterAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

let providerInput: { messages: Array<{ content: string }> };
let providerOptions: { timeout: number; maxRetries: number };
let output = '';

jest.unstable_mockModule('openai', () => ({
  default: class {
    constructor(options: { timeout: number; maxRetries: number }) { providerOptions = options; }
    chat = { completions: { create: async (input: typeof providerInput) => {
      providerInput = input;
      return { choices: [{ message: { content: output } }] };
    } } };
  }
}));

const { normalizeRequest } = await import('../../src/normalizer/ai-client.js');
const previousKey = process.env.AI_API_KEY;

beforeEach(() => {
  process.env.AI_API_KEY = 'unit-test-provider-key';
  output = JSON.stringify({ method: 'tools/call', params: { name: 'hub_list_servers' }, confidence: 0 });
});

afterAll(() => {
  if (previousKey === undefined) delete process.env.AI_API_KEY;
  else process.env.AI_API_KEY = previousKey;
});

describe('AI normalization boundaries', () => {
  test('redacts nested sensitive fields before sending requests to a provider', async () => {
    await normalizeRequest('openai', 'test-model', {
      method: 'tools/call', params: { api_key: 'sensitive-key', nested: [{ password: 'sensitive-password', value: 'public' }] }
    });
    const serialized = providerInput.messages[1].content;
    expect(serialized).not.toContain('sensitive-key');
    expect(serialized).not.toContain('sensitive-password');
    expect(serialized).toContain('[REDACTED]');
    expect(serialized).toContain('public');
    expect(providerOptions).toMatchObject({ timeout: 10_000, maxRetries: 0 });
  });

  test('preserves a valid zero-confidence result', async () => {
    const result = await normalizeRequest('openai', 'test-model', { method: 'tools/call' });
    expect(result.confidence).toBe(0);
  });

  test.each([
    { method: 'system/execute', params: {} },
    { method: 'tools/call', params: {}, confidence: 2 },
    { method: 'tools/call', params: 'invalid' }
  ])('rejects model-generated invalid normalization %j', async invalid => {
    output = JSON.stringify(invalid);
    const result = await normalizeRequest('openai', 'test-model', { method: 'tools/call', params: {} });
    expect(result.intent).toBe('fallback');
    expect(result.method).toBe('tools/call');
  });
});
