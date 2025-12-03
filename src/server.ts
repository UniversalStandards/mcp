import express from 'express';
import dotenv from 'dotenv';
import { handleRpc } from './proxy/rpc-handler.js';
import { getHealthStatus, checkReadiness, checkLiveness } from './monitoring/health.js';
import { getMetrics, getMetricsSummary } from './monitoring/metrics.js';
import { getCacheStats, clearCache } from './discovery/cache-manager.js';

dotenv.config();

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));

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
  const pattern = req.body.pattern as string | undefined;
  const cleared = clearCache(pattern);
  res.json({ cleared, pattern: pattern || 'all' });
});

// MCP JSON-RPC endpoint
app.post('/mcp/v1', handleRpc);
app.post('/', handleRpc); // Also support root endpoint

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
