import type { Server } from 'node:http';
import express from 'express';
import dotenv from 'dotenv';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { timingSafeEqual } from 'node:crypto';
import { getHealthStatus, checkReadiness, checkLiveness } from './monitoring/health.js';
import { getMetrics, getMetricsSummary } from './monitoring/metrics.js';
import { getCacheStats, clearCache } from './discovery/cache-manager.js';
import { closeMcpSessions, registerMcpRoutes } from './mcp/streamable-http.js';

dotenv.config();

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '127.0.0.1';
const allowedHosts = parseList(process.env.MCP_ALLOWED_HOSTS);
const app = createMcpExpressApp({
  host,
  ...(allowedHosts.length > 0 ? { allowedHosts } : {})
});

// Request logging
app.use((req, _res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  _res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${_res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Health endpoints
app.get('/health', async (_req, res) => {
  const health = await getHealthStatus();
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get('/health/ready', async (_req, res) => {
  const ready = await checkReadiness();
  res.status(ready ? 200 : 503).json({ ready });
});

app.get('/health/live', async (_req, res) => {
  const alive = await checkLiveness();
  res.status(alive ? 200 : 503).json({ alive });
});

// Metrics endpoints
app.get('/metrics', (_req, res) => {
  const metrics = getMetrics();
  res.json(metrics);
});

app.get('/metrics/summary', (_req, res) => {
  const summary = getMetricsSummary();
  res.type('text/plain').send(summary);
});

// Cache management
app.get('/admin/cache/stats', (_req, res) => {
  const stats = getCacheStats();
  res.json(stats);
});

app.post('/admin/cache/clear', (req, res) => {
  const expectedToken = process.env.MCP_AUTH_TOKEN?.trim();
  const suppliedToken = /^Bearer\s+(.+)$/i.exec(req.header('authorization') || '')?.[1];
  if (!expectedToken || !suppliedToken || !secureEquals(suppliedToken, expectedToken)) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(401).json({ error: 'Bearer authentication is required for cache administration' });
    return;
  }
  if (req.body.pattern !== undefined && (typeof req.body.pattern !== 'string' || req.body.pattern.length > 200)) {
    res.status(400).json({ error: 'pattern must be a string of at most 200 characters' });
    return;
  }
  const pattern = req.body.pattern as string | undefined;
  const cleared = clearCache(pattern);
  res.json({ cleared, pattern: pattern || 'all' });
});

// Standards-compliant MCP Streamable HTTP endpoint.
registerMcpRoutes(app);

// The former JSON-RPC route advertised mock results and could install packages
// from untrusted registry matches. Fail closed until real delegation exists.
const unsupportedLegacyRpc: express.RequestHandler = (_req, res) => {
  res.status(410).json({
    jsonrpc: '2.0',
    id: null,
    error: { code: -32000, message: 'Legacy JSON-RPC is retired; use the MCP endpoint at /mcp' }
  });
};
app.post('/mcp/v1', unsupportedLegacyRpc);
app.post('/', unsupportedLegacyRpc);

// Info endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Universal MCP Hub',
    version: '1.0.0',
    description: 'Local MCP hub with server inventory and registry search',
    endpoints: {
      mcp: 'Streamable HTTP at /mcp; legacy JSON-RPC endpoints return 410',
      health: 'GET /health',
      readiness: 'GET /health/ready',
      liveness: 'GET /health/live',
      metrics: 'GET /metrics',
      metricsSummary: 'GET /metrics/summary',
      cacheStats: 'GET /admin/cache/stats',
      cacheClear: 'POST /admin/cache/clear'
    },
    documentation: 'https://github.com/UniversalStandards/mcp'
  });
});

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist'
  });
});

export { app };

export function startServer(listenPort = port, listenHost = host): Server {
  const server = app.listen(listenPort, listenHost, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║          Universal Standards MCP Server                      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

Server Information:
  • Host: ${listenHost}
  • Port: ${listenPort}
  • Environment: ${process.env.NODE_ENV || 'development'}
  • Node Version: ${process.version}

Endpoints:
  • MCP Streamable HTTP: http://${listenHost}:${listenPort}/mcp
  • Legacy JSON-RPC: retired (HTTP 410)
  • Health: http://${listenHost}:${listenPort}/health
  • Metrics: http://${listenHost}:${listenPort}/metrics

Ready to serve MCP requests! 🚀
  `);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down gracefully...`);
    await closeMcpSessions();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  return server;
}

function parseList(value: string | undefined): string[] {
  return value
    ? value.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
}

function secureEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

if (!process.env.JEST_WORKER_ID) {
  startServer();
}
