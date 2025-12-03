import { EventEmitter } from 'node:events';

interface MetricData {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  lastUpdate: number;
}

interface RequestMetrics {
  total: number;
  successful: number;
  failed: number;
  avgDuration: number;
  byMethod: Record<string, MetricData>;
}

interface ServerMetrics {
  uptime: number;
  requests: RequestMetrics;
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  discovery: {
    searches: number;
    installations: number;
    failures: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

class MetricsCollector extends EventEmitter {
  private startTime: number;
  private requestCount: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private requestDurations: number[] = [];
  private methodMetrics: Map<string, MetricData> = new Map();
  
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  
  private searchCount: number = 0;
  private installCount: number = 0;
  private installFailures: number = 0;

  constructor() {
    super();
    this.startTime = Date.now();
    
    // Emit metrics periodically
    setInterval(() => {
      this.emit('metrics', this.getMetrics());
    }, 60000); // Every minute
  }

  recordRequest(method: string, duration: number, success: boolean): void {
    this.requestCount++;
    
    if (success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }
    
    // Keep last 1000 durations for average calculation
    this.requestDurations.push(duration);
    if (this.requestDurations.length > 1000) {
      this.requestDurations.shift();
    }
    
    // Update method-specific metrics
    const existing = this.methodMetrics.get(method) || {
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      avg: 0,
      lastUpdate: Date.now()
    };
    
    existing.count++;
    existing.sum += duration;
    existing.min = Math.min(existing.min, duration);
    existing.max = Math.max(existing.max, duration);
    existing.avg = existing.sum / existing.count;
    existing.lastUpdate = Date.now();
    
    this.methodMetrics.set(method, existing);
    
    this.emit('request', { method, duration, success });
  }

  recordCacheHit(): void {
    this.cacheHits++;
  }

  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  recordSearch(): void {
    this.searchCount++;
  }

  recordInstallation(success: boolean): void {
    this.installCount++;
    if (!success) {
      this.installFailures++;
    }
  }

  getMetrics(): ServerMetrics {
    const avgDuration = this.requestDurations.length > 0
      ? this.requestDurations.reduce((a, b) => a + b, 0) / this.requestDurations.length
      : 0;
    
    const totalCache = this.cacheHits + this.cacheMisses;
    const hitRate = totalCache > 0 ? this.cacheHits / totalCache : 0;
    
    const memUsage = process.memoryUsage();
    const memTotal = memUsage.heapTotal;
    const memUsed = memUsage.heapUsed;
    
    const byMethod: Record<string, MetricData> = {};
    for (const [method, data] of this.methodMetrics) {
      byMethod[method] = data;
    }
    
    return {
      uptime: Date.now() - this.startTime,
      requests: {
        total: this.requestCount,
        successful: this.successfulRequests,
        failed: this.failedRequests,
        avgDuration,
        byMethod
      },
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate
      },
      discovery: {
        searches: this.searchCount,
        installations: this.installCount,
        failures: this.installFailures
      },
      memory: {
        used: memUsed,
        total: memTotal,
        percentage: (memUsed / memTotal) * 100
      }
    };
  }

  reset(): void {
    this.requestCount = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.requestDurations = [];
    this.methodMetrics.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.searchCount = 0;
    this.installCount = 0;
    this.installFailures = 0;
  }

  getSummary(): string {
    const metrics = this.getMetrics();
    const uptimeSeconds = Math.floor(metrics.uptime / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    
    return `
Universal MCP Hub Metrics
========================
Uptime: ${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s
Requests: ${metrics.requests.total} (✓ ${metrics.requests.successful}, ✗ ${metrics.requests.failed})
Avg Duration: ${metrics.requests.avgDuration.toFixed(2)}ms
Cache Hit Rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%
Discoveries: ${metrics.discovery.searches} searches, ${metrics.discovery.installations} installs
Memory: ${(metrics.memory.used / 1024 / 1024).toFixed(2)}MB / ${(metrics.memory.total / 1024 / 1024).toFixed(2)}MB (${metrics.memory.percentage.toFixed(1)}%)
    `.trim();
  }
}

// Singleton instance
export const metrics = new MetricsCollector();

// Convenience functions
export function recordRequest(method: string, duration: number, success: boolean): void {
  metrics.recordRequest(method, duration, success);
}

export function recordCacheHit(): void {
  metrics.recordCacheHit();
}

export function recordCacheMiss(): void {
  metrics.recordCacheMiss();
}

export function recordSearch(): void {
  metrics.recordSearch();
}

export function recordInstallation(success: boolean): void {
  metrics.recordInstallation(success);
}

export function getMetrics(): ServerMetrics {
  return metrics.getMetrics();
}

export function getMetricsSummary(): string {
  return metrics.getSummary();
}
