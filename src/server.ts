import crypto from 'node:crypto';
import path from 'node:path';
import type { Server } from 'node:http';
import express from 'express';
import dotenv from 'dotenv';
import { pathToFileURL } from 'node:url';
import { handleRpc } from './proxy/rpc-handler.js';
import { getHealthStatus, checkReadiness, checkLiveness } from './monitoring/health.js';
import { getMetrics, getMetricsSummary } from './monitoring/metrics.js';
import { getCacheStats, clearCache } from './discovery/cache-manager.js';
import { createAuthenticationMiddleware, createMcpAuthorizationMiddleware, createRequestSafetyMiddleware } from './auth/http-authentication.js';

dotenv.config({ quiet: true });

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);

  const protectedRequestSafety = createRequestSafetyMiddleware();
  const authenticateMcp = createAuthenticationMiddleware('required');
  const authorizeMcp = createMcpAuthorizationMiddleware({
    action: 'mcp:invoke',
    resource: 'mcp://universal-mcp-hub',
  });
  const authenticateAdmin = createAuthenticationMiddleware('required');
  const authorizeAdmin = createMcpAuthorizationMiddleware({
    action: 'admin:cache',
    resource: 'mcp://universal-mcp-hub/admin/cache',
    requiredScopes: ['admin:cache'],
    requiredRoles: ['admin'],
  });
  const authorizeMetrics = createMcpAuthorizationMiddleware({
    action: 'metrics:read',
    resource: 'mcp://universal-mcp-hub/metrics',
    requiredScopes: ['metrics:read'],
    requiredRoles: ['admin'],
  });

  const json = express.json({ limit: process.env.BODY_LIMIT ?? '1mb' });

  app.use((req, res, next) => {
    const suppliedRequestId = req.header('x-request-id')?.trim();
    const requestId = suppliedRequestId && /^[A-Za-z0-9._-]{1,128}$/.test(suppliedRequestId)
      ? suppliedRequestId
      : crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use(protectedRequestSafety);

  // Liveness remains public so an orchestrator can distinguish a live process
  // from a process that is alive but not ready to serve protected work.
  app.get('/health/live', async (_req, res) => {
    const alive = await checkLiveness();
    res.status(alive ? 200 : 503).json({ alive });
  });
  app.get('/health/ready', async (_req, res) => {
    const ready = await checkReadiness();
    res.status(ready ? 200 : 503).json({ ready });
  });

  // Protect namespaces before parsing bodies or invoking handlers, including future routes.
  app.use('/mcp', authenticateMcp, authorizeMcp);
  app.use('/admin', authenticateAdmin, authorizeAdmin);
  app.use('/metrics', authenticateAdmin, authorizeMetrics);
  app.use('/health', authenticateAdmin, authorizeMetrics);

  app.get('/health', async (_req, res) => {
    const health = await getHealthStatus();
    const statusCode = health.status === 'healthy' || health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  app.get('/metrics', (_req, res) => {
    res.json(getMetrics());
  });

  app.get('/metrics/summary', (_req, res) => {
    res.type('text/plain').send(getMetricsSummary());
  });

  app.get('/admin/cache/stats', (_req, res) => {
    res.json(getCacheStats());
  });

  app.post('/admin/cache/clear', json, (req, res) => {
    if (req.body !== undefined && (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body) ||
        (req.body.pattern !== undefined && typeof req.body.pattern !== 'string'))) {
      res.status(400).json({ error: 'invalid_cache_pattern' });
      return;
    }
    const pattern = typeof req.body?.pattern === 'string' ? req.body.pattern : undefined;
    const cleared = clearCache(pattern);
    res.json({ cleared, pattern: pattern || 'all' });
  });

  app.post('/mcp/v1', json, handleRpc);
  app.post('/', authenticateMcp, authorizeMcp, json, handleRpc);

  app.get('/', (_req, res) => {
    res.json({
      name: 'Universal MCP Hub',
      version: '1.0.0',
      description: 'Self-expanding MCP server with auto-discovery and installation',
      endpoints: {
        mcp: 'POST /mcp/v1 or POST /',
        health: 'GET /health',
        readiness: 'GET /health/ready',
        liveness: 'GET /health/live',
        metrics: 'GET /metrics',
        metricsSummary: 'GET /metrics/summary',
        cacheStats: 'GET /admin/cache/stats',
        cacheClear: 'POST /admin/cache/clear',
      },
      documentation: 'https://github.com/UniversalStandards/mcp',
    });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) { next(err); return; }
    const type = err && typeof err === 'object' && 'type' in err ? err.type : undefined;
    const status = type === 'entity.too.large' ? 413 : type === 'entity.parse.failed' ? 400 : 500;
    // Exception messages may contain credentials or submitted request bodies.
    res.status(status).json({
      error: status === 413 ? 'payload_too_large' : status === 400 ? 'invalid_json' : 'internal_server_error',
      requestId: res.getHeader('X-Request-ID'),
    });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found', message: 'The requested endpoint does not exist' });
  });
  return app;
}

export const app = createApp();

function integerSetting(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  return value;
}

export function startServer(application: express.Express = app): Server {
  const port = integerSetting('PORT', 3000, 0, 65535);
  const host = process.env.HOST?.trim() || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !process.env.MCP_ALLOWED_HOSTS?.trim()) {
    throw new Error('Non-loopback binding requires MCP_ALLOWED_HOSTS');
  }
  const server = application.listen(port, host);
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

const shutdowns = new WeakMap<Server, Promise<boolean>>();

/** Resolves true after draining, false after forcibly closing remaining HTTP connections. */
export function shutdownServer(server: Server, timeoutMs = 10_000): Promise<boolean> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Error('Shutdown timeout must be between 1 and 60000 milliseconds');
  }
  const pending = shutdowns.get(server);
  if (pending) return pending;
  const shutdown = new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => {
      server.closeAllConnections();
      resolve(false);
    }, timeoutMs);
    server.close((error) => {
      clearTimeout(timer);
      if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
      else resolve(true);
    });
    server.closeIdleConnections();
  });
  shutdowns.set(server, shutdown);
  return shutdown;
}

function isEntrypoint(): boolean {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isEntrypoint()) {
  const timeout = integerSetting('SERVER_SHUTDOWN_TIMEOUT_MS', 10_000, 1, 60_000);
  const server = startServer();
  const shutdown = (): void => {
    void shutdownServer(server, timeout).then(
      (graceful) => process.exit(graceful ? 0 : 1),
      () => process.exit(1),
    );
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
