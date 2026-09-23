import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { Express, Request, RequestHandler, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createUniversalMcpServer } from './universal-server.js';

interface McpSession {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  lastActivityAt: number;
}

const sessions = new Map<string, McpSession>();

const sessionCleanupTimer = setInterval(() => {
  const cutoff = Date.now() - getSessionTtlMs();

  for (const [sessionId, session] of sessions) {
    if (session.lastActivityAt < cutoff) {
      void closeSession(sessionId, session);
    }
  }
}, 60 * 1000);
sessionCleanupTimer.unref();

/** Register the MCP Streamable HTTP endpoint on the application. */
export function registerMcpRoutes(app: Express): void {
  const guards: RequestHandler[] = [validateOrigin, requireBearerToken];

  app.post('/mcp', ...guards, (req, res) => {
    void handlePost(req, res);
  });

  app.get('/mcp', ...guards, (req, res) => {
    void handleGet(req, res);
  });

  app.delete('/mcp', ...guards, (req, res) => {
    void handleDelete(req, res);
  });
}

export async function closeMcpSessions(): Promise<void> {
  clearInterval(sessionCleanupTimer);
  await Promise.allSettled(
    Array.from(sessions.entries()).map(([sessionId, session]) => closeSession(sessionId, session))
  );
}

export function getMcpSessionCount(): number {
  return sessions.size;
}

async function handlePost(req: Request, res: Response): Promise<void> {
  const sessionId = getHeader(req, 'mcp-session-id');

  try {
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        sendProtocolError(res, 404, 'Unknown MCP session');
        return;
      }

      session.lastActivityAt = Date.now();
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    if (!isInitializeRequest(req.body)) {
      sendProtocolError(res, 400, 'An MCP session ID is required after initialization');
      return;
    }

    const session = await createSession();
    await session.transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP POST request failed:', error instanceof Error ? error.message : 'Unknown error');
    sendProtocolError(res, 500, 'Internal MCP server error');
  }
}

async function handleGet(req: Request, res: Response): Promise<void> {
  const sessionId = getHeader(req, 'mcp-session-id');
  const session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    sendProtocolError(res, sessionId ? 404 : 400, sessionId ? 'Unknown MCP session' : 'MCP session ID is required');
    return;
  }

  try {
    session.lastActivityAt = Date.now();
    await session.transport.handleRequest(req, res);
  } catch (error) {
    console.error('MCP GET request failed:', error instanceof Error ? error.message : 'Unknown error');
    sendProtocolError(res, 500, 'Internal MCP server error');
  }
}

async function handleDelete(req: Request, res: Response): Promise<void> {
  const sessionId = getHeader(req, 'mcp-session-id');
  const session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    sendProtocolError(res, sessionId ? 404 : 400, sessionId ? 'Unknown MCP session' : 'MCP session ID is required');
    return;
  }

  try {
    await session.transport.handleRequest(req, res);
  } catch (error) {
    console.error('MCP DELETE request failed:', error instanceof Error ? error.message : 'Unknown error');
    sendProtocolError(res, 500, 'Internal MCP server error');
  }
}

async function createSession(): Promise<McpSession> {
  const server = createUniversalMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: process.env.MCP_ENABLE_JSON_RESPONSE !== 'false',
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, {
        server,
        transport,
        lastActivityAt: Date.now()
      });
    }
  });

  transport.onclose = () => {
    const sessionId = transport.sessionId;
    if (sessionId) {
      sessions.delete(sessionId);
    }
  };

  transport.onerror = (error) => {
    console.error('MCP transport error:', error.message);
  };

  await server.connect(transport);

  return {
    server,
    transport,
    lastActivityAt: Date.now()
  };
}

async function closeSession(sessionId: string, session: McpSession): Promise<void> {
  sessions.delete(sessionId);
  try {
    await session.server.close();
  } catch (error) {
    console.warn(`MCP session ${sessionId} close failed:`, error instanceof Error ? error.message : 'Unknown error');
  }
}

const validateOrigin: RequestHandler = (req, res, next) => {
  const origin = req.header('origin');
  const allowedOrigins = parseList(process.env.MCP_ALLOWED_ORIGINS);

  if (origin && !allowedOrigins.includes(origin)) {
    sendProtocolError(res, 403, 'Origin is not allowed');
    return;
  }

  next();
};

const requireBearerToken: RequestHandler = (req, res, next) => {
  const expectedToken = process.env.MCP_AUTH_TOKEN?.trim();
  if (!expectedToken) {
    next();
    return;
  }

  const authorization = req.header('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match || !secureEquals(match[1], expectedToken)) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    sendProtocolError(res, 401, 'Bearer authentication is required');
    return;
  }

  next();
};

function secureEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function parseList(value: string | undefined): string[] {
  return value
    ? value.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getSessionTtlMs(): number {
  return parsePositiveInteger(process.env.MCP_SESSION_TTL_MS, 30 * 60 * 1000);
}

function sendProtocolError(res: Response, status: number, message: string): void {
  if (res.headersSent) {
    return;
  }

  res.status(status).json({
    jsonrpc: '2.0',
    id: null,
    error: {
      code: -32000,
      message
    }
  });
}
