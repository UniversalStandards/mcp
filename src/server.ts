import express from 'express';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { handleRpc } from './proxy/rpc-handler.js';
import { getHealthStatus, checkReadiness, checkLiveness } from './monitoring/health.js';
import { getMetrics, getMetricsSummary } from './monitoring/metrics.js';
import { getCacheStats, clearCache } from './discovery/cache-manager.js';
import { createAuthenticationMiddleware, createMcpAuthorizationMiddleware, getAuthMode } from './auth/http-authentication.js';
import { getOidcProtectedResourceMetadata } from './auth/oidc.js';

dotenv.config();

export const app = express();
app.disable('x-powered-by');

const authenticateMcp = createAuthenticationMiddleware();
const authorizeMcp = createMcpAuthorizationMiddleware({
  action: 'mcp:invoke',
  resource: 'mcp://universal-mcp-hub',
});
const authenticateAdmin = createAuthenticationMiddleware('required');
const authorizeAdmin = createMcpAuthorizationMiddleware({
  action: 'admin:cache',
  resource: 'mcp://universal-mcp-hub/admin/cache',
  requiredRoles: ['admin'],
});

// Middleware
app.use(express.json({ limit: process.env.BODY_LIMIT ?? '1mb' }));

app.use((req, res, next) => {
  const requestId = req.header('x-request-id')?.trim() || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// Request logging
app.use((req, _res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} requestId=${req.requestId}`);
  
  _res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${_res.statusCode} (${duration}ms) requestId=${req.requestId}`);
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

// RFC 9728 protected-resource metadata for MCP authorization discovery.
app.get('/.well-known/oauth-protected-resource', (req, res) => {
  const resourceUrl = process.env.MCP_RESOURCE_URL?.trim() || `${req.protocol}://${req.get('host')}/mcp/v1`;
  res.json(getOidcProtectedResourceMetadata(resourceUrl));
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
app.get('/admin/cache/stats', authenticateAdmin, authorizeAdmin, (_req, res) => {
  const stats = getCacheStats();
  res.json(stats);
});

app.post('/admin/cache/clear', authenticateAdmin, authorizeAdmin, (req, res) => {
  const pattern = req.body.pattern as string | undefined;
  const cleared = clearCache(pattern);
  res.json({ cleared, pattern: pattern || 'all' });
});

// MCP JSON-RPC endpoint
app.post('/mcp/v1', authenticateMcp, authorizeMcp, handleRpc);
app.post('/', authenticateMcp, authorizeMcp, handleRpc); // Also support root endpoint

// Info endpoint
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
      protectedResourceMetadata: 'GET /.well-known/oauth-protected-resource',
      cacheStats: 'GET /admin/cache/stats',
      cacheClear: 'POST /admin/cache/clear',
      authMode: getAuthMode(),
    },
    documentation: 'https://github.com/UniversalStandards/mcp'
  });
});

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', { name: err.name, message: err.message, requestId: _req.requestId });
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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start server
const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║          Universal MCP Hub - Self-Expanding Server           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

Server Information:
  • Host: ${host}
  • Port: ${port}
  • Environment: ${process.env.NODE_ENV || 'development'}
  • Node Version: ${process.version}

Endpoints:
  • MCP RPC: http://${host}:${port}/mcp/v1
  • Health: http://${host}:${port}/health
  • Metrics: http://${host}:${port}/metrics

Ready to serve MCP requests! 🚀
  `);
});
