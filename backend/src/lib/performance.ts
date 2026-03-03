import { logger } from '../utils/logger';

/**
 * Backend performance monitoring
 * Tracks response times, throughput, error rates, database query duration
 */

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: number;
  dbQueryTime?: number;
  cacheHit: boolean;
  errorMessage?: string;
}

export interface AggregatedMetrics {
  endpoint: string;
  method: string;
  count: number;
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  errorCount: number;
  errorRate: number;
  cacheHitRate: number;
  throughput: number; // requests per second
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetrics = 10000;
  private aggregated: Map<string, AggregatedMetrics> = new Map();

  /**
   * Record a request metric
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Update aggregated metrics
    this.updateAggregated(metric);
  }

  /**
   * Update aggregated metrics
   */
  private updateAggregated(metric: PerformanceMetrics): void {
    const key = `${metric.method} ${metric.endpoint}`;
    const current = this.aggregated.get(key) || {
      endpoint: metric.endpoint,
      method: metric.method,
      count: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      errorCount: 0,
      errorRate: 0,
      cacheHitRate: 0,
      throughput: 0,
    };

    current.count++;
    current.maxResponseTime = Math.max(current.maxResponseTime, metric.responseTime);
    current.minResponseTime = Math.min(current.minResponseTime, metric.responseTime);
    current.avgResponseTime =
      (current.avgResponseTime * (current.count - 1) + metric.responseTime) / current.count;

    if (metric.statusCode >= 400) {
      current.errorCount++;
    }

    current.errorRate = current.errorCount / current.count;

    this.aggregated.set(key, current);
  }

  /**
   * Get metrics for an endpoint
   */
  getEndpointMetrics(endpoint: string, method?: string): PerformanceMetrics[] {
    return this.metrics.filter(
      (m) => m.endpoint === endpoint && (!method || m.method === method)
    );
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(): AggregatedMetrics[] {
    return Array.from(this.aggregated.values());
  }

  /**
   * Get slow endpoints (responses > 1 second)
   */
  getSlowEndpoints(threshold: number = 1000): AggregatedMetrics[] {
    return Array.from(this.aggregated.values())
      .filter((m) => m.avgResponseTime > threshold)
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime);
  }

  /**
   * Get error endpoints
   */
  getErrorEndpoints(): AggregatedMetrics[] {
    return Array.from(this.aggregated.values())
      .filter((m) => m.errorCount > 0)
      .sort((a, b) => b.errorCount - a.errorCount);
  }

  /**
   * Get top endpoints by request count
   */
  getTopEndpoints(limit: number = 20): AggregatedMetrics[] {
    return Array.from(this.aggregated.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Calculate throughput (requests per second)
   */
  calculateThroughput(): number {
    if (this.metrics.length < 2) return 0;

    const oldestTime = this.metrics[0].timestamp;
    const newestTime = this.metrics[this.metrics.length - 1].timestamp;
    const durationSeconds = (newestTime - oldestTime) / 1000;

    return durationSeconds > 0 ? this.metrics.length / durationSeconds : 0;
  }

  /**
   * Get system health summary
   */
  getHealthSummary() {
    const metrics = Array.from(this.aggregated.values());
    const totalRequests = metrics.reduce((sum, m) => sum + m.count, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + m.errorCount, 0);
    const avgResponseTime =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.avgResponseTime * m.count, 0) / totalRequests
        : 0;

    return {
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      avgResponseTime,
      maxResponseTime: Math.max(...metrics.map((m) => m.maxResponseTime)),
      minResponseTime: Math.min(...metrics.map((m) => m.minResponseTime)),
      throughput: this.calculateThroughput(),
      endpointCount: metrics.length,
    };
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics = [];
    this.aggregated.clear();
  }

  /**
   * Export metrics for external monitoring
   */
  export() {
    return {
      raw: this.metrics.slice(-1000), // Last 1000 metrics
      aggregated: Array.from(this.aggregated.values()),
      health: this.getHealthSummary(),
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Fastify performance monitoring hook
 */
export async function performanceMonitoringHook(fastify: any) {
  fastify.addHook('onRequest', async (request: any) => {
    request.startTime = Date.now();
  });

  fastify.addHook('onSend', async (request: any, reply: any) => {
    const responseTime = Date.now() - request.startTime;

    performanceMonitor.recordMetric({
      endpoint: request.url,
      method: request.method,
      responseTime,
      statusCode: reply.statusCode || 200,
      timestamp: Date.now(),
      cacheHit: reply.getHeader('etag') ? true : false,
    });

    // Add custom headers
    reply.header('x-response-time', `${responseTime}ms`);

    // Log slow requests
    if (responseTime > 1000) {
      logger.warn(`Slow request: ${request.method} ${request.url} (${responseTime}ms)`);
    }
  });

  // Expose metrics endpoint
  fastify.get('/metrics', async (request: any, reply: any) => {
    return performanceMonitor.getHealthSummary();
  });

  fastify.get('/metrics/endpoints', async (request: any, reply: any) => {
    return performanceMonitor.getAggregatedMetrics();
  });

  fastify.get('/metrics/slow', async (request: any, reply: any) => {
    const threshold = parseInt(request.query.threshold || '1000', 10);
    return performanceMonitor.getSlowEndpoints(threshold);
  });

  fastify.get('/metrics/errors', async (request: any, reply: any) => {
    return performanceMonitor.getErrorEndpoints();
  });

  fastify.get('/metrics/export', async (request: any, reply: any) => {
    return performanceMonitor.export();
  });
}

/**
 * Measure database query performance
 */
export async function measureQueryPerformance<T>(
  queryName: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    if (duration > 500) {
      logger.warn(`Slow database query: ${queryName} (${duration}ms)`);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Database query error: ${queryName} (${duration}ms)`, error);
    throw error;
  }
}
