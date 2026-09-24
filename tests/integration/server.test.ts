import { once } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { beforeAll, afterAll, describe, test, expect } from '@jest/globals';

type JsonObject = Record<string, unknown>;

describe('Server Integration', () => {
  let serverProcess: ChildProcess;
  let baseUrl: string;
  const port = 31317;

  beforeAll(async () => {
    const childEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: String(port),
      MCP_ALLOWED_HOSTS: '127.0.0.1',
      MCP_AUTH_TOKEN: '',
      MCP_ALLOWED_ORIGINS: '',
      MCP_CONFIG_FILE: path.resolve('tests/fixtures/mcp-config-with-secret.json')
    };
    delete childEnvironment.JEST_WORKER_ID;

    serverProcess = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
      cwd: process.cwd(),
      env: childEnvironment,
      stdio: 'ignore'
    });
    baseUrl = `http://127.0.0.1:${port}`;

    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const response = await fetch(`${baseUrl}/health/live`);
        if (response.ok) {
          return;
        }
      } catch {
        // The server may still be starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error('Timed out waiting for the integration server');
  });

  afterAll(async () => {
    if (serverProcess && !serverProcess.killed) {
      const exited = once(serverProcess, 'exit');
      serverProcess.kill();
      await exited;
    }
  });

  async function requestJson(path: string, init?: RequestInit): Promise<{ response: Response; data: JsonObject }> {
    const response = await fetch(`${baseUrl}${path}`, init);
    const text = await response.text();
    return { response, data: text ? JSON.parse(text) as JsonObject : {} };
  }

  async function mcpRequest(body: unknown, sessionId?: string): Promise<{ response: Response; data: JsonObject }> {
    return requestJson('/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {})
      },
      body: JSON.stringify(body)
    });
  }

  test('should report liveness', async () => {
    const { response, data } = await requestJson('/health/live');

    expect(response.status).toBe(200);
    expect(data).toEqual({ alive: true });
  });

  test('retires legacy JSON-RPC without claiming a tool ran', async () => {
    const { response, data } = await requestJson('/mcp/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {}
      })
    });

    const error = data.error as JsonObject;
    expect(response.status).toBe(410);
    expect(data.jsonrpc).toBe('2.0');
    expect(error.message).toContain('retired');
    expect(data.result).toBeUndefined();
  });

  test('rejects cache mutations when no admin token is configured', async () => {
    const { response } = await requestJson('/admin/cache/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(response.status).toBe(401);
  });

  test('rejects browser origins unless explicitly allowed', async () => {
    const { response } = await requestJson('/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
    });
    expect(response.status).toBe(403);
  });

  test('should complete MCP initialize, tools/list, and tools/call over Streamable HTTP', async () => {
    const initialize = await mcpRequest({
      jsonrpc: '2.0',
      id: 'init-1',
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'integration-test', version: '1.0.0' }
      }
    });

    const sessionId = initialize.response.headers.get('mcp-session-id');
    const initializeResult = initialize.data.result as JsonObject;
    const serverInfo = initializeResult.serverInfo as JsonObject;
    expect(initialize.response.status).toBe(200);
    expect(sessionId).toBeTruthy();
    expect(serverInfo.name).toBe('universal-standards-mcp');

    await mcpRequest({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {}
    }, sessionId || undefined);

    const listed = await mcpRequest({
      jsonrpc: '2.0',
      id: 'list-1',
      method: 'tools/list',
      params: {}
    }, sessionId || undefined);
    const listedResult = listed.data.result as JsonObject;
    const tools = listedResult.tools as Array<JsonObject>;
    expect(listed.response.status).toBe(200);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['hub_list_servers', 'hub_search_servers', 'hub_browse_mcp_registry', 'hub_health'])
    );

    const called = await mcpRequest({
      jsonrpc: '2.0',
      id: 'call-1',
      method: 'tools/call',
      params: { name: 'hub_list_servers', arguments: {} }
    }, sessionId || undefined);
    const calledResult = called.data.result as JsonObject;
    const content = calledResult.content as Array<JsonObject>;
    const payload = JSON.parse(content[0].text as string) as JsonObject;
    expect(called.response.status).toBe(200);
    expect(Array.isArray(payload.servers)).toBe(true);
    expect(JSON.stringify(payload)).not.toContain('SYNTHETIC_SENSITIVE_VALUE');
    expect((payload.servers as Array<JsonObject>)[0].argumentCount).toBe(2);

    const deleted = await requestJson('/mcp', {
      method: 'DELETE',
      headers: {
        Accept: 'application/json, text/event-stream',
        ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {})
      }
    });
    expect([200, 202]).toContain(deleted.response.status);
  });
});
