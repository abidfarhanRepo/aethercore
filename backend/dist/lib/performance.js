"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceMonitor = void 0;
exports.performanceMonitoringHook = performanceMonitoringHook;
exports.measureQueryPerformance = measureQueryPerformance;
const logger_1 = require("../utils/logger");
class PerformanceMonitor {
    constructor() {
        this.metrics = [];
        this.maxMetrics = 10000;
        this.aggregated = new Map();
    }
    /**
     * Record a request metric
     */
    recordMetric(metric) {
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
    updateAggregated(metric) {
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
    getEndpointMetrics(endpoint, method) {
        return this.metrics.filter((m) => m.endpoint === endpoint && (!method || m.method === method));
    }
    /**
     * Get aggregated metrics
     */
    getAggregatedMetrics() {
        return Array.from(this.aggregated.values());
    }
    /**
     * Get slow endpoints (responses > 1 second)
     */
    getSlowEndpoints(threshold = 1000) {
        return Array.from(this.aggregated.values())
            .filter((m) => m.avgResponseTime > threshold)
            .sort((a, b) => b.avgResponseTime - a.avgResponseTime);
    }
    /**
     * Get error endpoints
     */
    getErrorEndpoints() {
        return Array.from(this.aggregated.values())
            .filter((m) => m.errorCount > 0)
            .sort((a, b) => b.errorCount - a.errorCount);
    }
    /**
     * Get top endpoints by request count
     */
    getTopEndpoints(limit = 20) {
        return Array.from(this.aggregated.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }
    /**
     * Calculate throughput (requests per second)
     */
    calculateThroughput() {
        if (this.metrics.length < 2)
            return 0;
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
        const avgResponseTime = metrics.length > 0
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
    clear() {
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
exports.performanceMonitor = new PerformanceMonitor();
/**
 * Fastify performance monitoring hook
 */
async function performanceMonitoringHook(fastify) {
    fastify.addHook('onRequest', async (request) => {
        request.startTime = Date.now();
    });
    fastify.addHook('onSend', async (request, reply) => {
        const responseTime = Date.now() - request.startTime;
        exports.performanceMonitor.recordMetric({
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
            logger_1.logger.warn(`Slow request: ${request.method} ${request.url} (${responseTime}ms)`);
        }
    });
    // Expose metrics endpoint
    fastify.get('/metrics', async (request, reply) => {
        return exports.performanceMonitor.getHealthSummary();
    });
    fastify.get('/metrics/endpoints', async (request, reply) => {
        return exports.performanceMonitor.getAggregatedMetrics();
    });
    fastify.get('/metrics/slow', async (request, reply) => {
        const threshold = parseInt(request.query.threshold || '1000', 10);
        return exports.performanceMonitor.getSlowEndpoints(threshold);
    });
    fastify.get('/metrics/errors', async (request, reply) => {
        return exports.performanceMonitor.getErrorEndpoints();
    });
    fastify.get('/metrics/export', async (request, reply) => {
        return exports.performanceMonitor.export();
    });
}
/**
 * Measure database query performance
 */
async function measureQueryPerformance(queryName, fn) {
    const startTime = Date.now();
    try {
        const result = await fn();
        const duration = Date.now() - startTime;
        if (duration > 500) {
            logger_1.logger.warn(`Slow database query: ${queryName} (${duration}ms)`);
        }
        return result;
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error(`Database query error: ${queryName} (${duration}ms)`, error);
        throw error;
    }
}
