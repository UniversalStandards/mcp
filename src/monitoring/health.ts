import fs from 'node:fs';
import { getCacheStats } from '../discovery/cache-manager.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  duration?: number;
}

const startTime = Date.now();

export async function getHealthStatus(): Promise<HealthStatus> {
  const checks: HealthCheck[] = [];
  
  // Check filesystem access
  checks.push(await checkFilesystem());
  
  // Check memory usage
  checks.push(checkMemory());
  
  // Check cache
  checks.push(checkCache());
  
  // Check environment variables
  checks.push(checkEnvironment());
  
  // Determine overall status
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (failCount > 0) {
    overallStatus = 'unhealthy';
  } else if (warnCount > 0) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
    checks
  };
}

async function checkFilesystem(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    const dirs = ['./cache', './config', './servers'];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        return {
          name: 'filesystem',
          status: 'fail',
          message: `Directory ${dir} does not exist`,
          duration: Date.now() - start
        };
      }
      
      // Test write access
      const testFile = `${dir}/.health-check`;
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      } catch (error) {
        return {
          name: 'filesystem',
          status: 'fail',
          message: `No write access to ${dir}`,
          duration: Date.now() - start
        };
      }
    }
    
    return {
      name: 'filesystem',
      status: 'pass',
      duration: Date.now() - start
    };
  } catch (error) {
    return {
      name: 'filesystem',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start
    };
  }
}

function checkMemory(): HealthCheck {
  const usage = process.memoryUsage();
  const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
  
  if (heapUsedPercent > 90) {
    return {
      name: 'memory',
      status: 'fail',
      message: `High memory usage: ${heapUsedPercent.toFixed(1)}%`
    };
  }
  
  if (heapUsedPercent > 75) {
    return {
      name: 'memory',
      status: 'warn',
      message: `Elevated memory usage: ${heapUsedPercent.toFixed(1)}%`
    };
  }
  
  return {
    name: 'memory',
    status: 'pass',
    message: `Memory usage: ${heapUsedPercent.toFixed(1)}%`
  };
}

function checkCache(): HealthCheck {
  try {
    const stats = getCacheStats();
    
    if (stats.entries > 10000) {
      return {
        name: 'cache',
        status: 'warn',
        message: `Large cache size: ${stats.entries} entries`
      };
    }
    
    return {
      name: 'cache',
      status: 'pass',
      message: `${stats.entries} entries cached`
    };
  } catch (error) {
    return {
      name: 'cache',
      status: 'fail',
      message: 'Cache system error'
    };
  }
}

function checkEnvironment(): HealthCheck {
  const required = ['GITHUB_TOKEN', 'AI_API_KEY'];
  const missing: string[] = [];
  const warnings: string[] = [];
  
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  // Check optional but recommended
  if (!process.env.ENCRYPTION_KEY) {
    warnings.push('ENCRYPTION_KEY (using default)');
  }
  if (!process.env.JWT_SECRET) {
    warnings.push('JWT_SECRET (using default)');
  }
  
  if (missing.length > 0) {
    return {
      name: 'environment',
      status: 'fail',
      message: `Missing required variables: ${missing.join(', ')}`
    };
  }
  
  if (warnings.length > 0) {
    return {
      name: 'environment',
      status: 'warn',
      message: `Missing optional variables: ${warnings.join(', ')}`
    };
  }
  
  return {
    name: 'environment',
    status: 'pass',
    message: 'All required variables configured'
  };
}

export async function checkReadiness(): Promise<boolean> {
  const health = await getHealthStatus();
  return health.status !== 'unhealthy';
}

export async function checkLiveness(): Promise<boolean> {
  // Basic liveness check - is the process running?
  return true;
}
