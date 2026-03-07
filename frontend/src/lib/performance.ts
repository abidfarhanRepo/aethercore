/**
 * Frontend performance monitoring
 * Tracks page load time, component render time, API call duration
 * Sends metrics to backend for analysis
 */

export interface PageLoadMetrics {
  pageName: string;
  loadTime: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint?: number;
  timeToInteractive: number;
  totalBlockingTime?: number;
}

export interface ComponentMetrics {
  componentName: string;
  renderTime: number;
  timestamp: number;
}

export interface APICallMetrics {
  url: string;
  method: string;
  duration: number;
  statusCode: number;
  cacheHit: boolean;
  timestamp: number;
}

class FrontendPerformanceMonitor {
  private pageMetrics: PageLoadMetrics[] = [];
  private componentMetrics: ComponentMetrics[] = [];
  private apiMetrics: APICallMetrics[] = [];
  private readonly maxMetrics = 1000;

  /**
   * Measure page load with Web Vitals
   */
  measurePageLoad(pageName: string): void {
    if (typeof window === 'undefined') return;

    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.recordPageMetrics(pageName);
      });
    } else {
      this.recordPageMetrics(pageName);
    }
  }

  /**
   * Record page metrics using Performance API
   */
  private recordPageMetrics(pageName: string): void {
    if (typeof window === 'undefined') return;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    const cls = performance.getEntriesByType('layout-shift');

    const fcp = paint.find((p) => p.name === 'first-contentful-paint')?.startTime || 0;
    const fmp = paint.find((p) => p.name === 'first-paint')?.startTime || 0;

    // Calculate Time to Interactive (rough estimate)
    const tti = navigation?.domInteractive || fcp + 100;

    const metrics: PageLoadMetrics = {
      pageName,
      loadTime: navigation?.loadEventEnd - navigation?.fetchStart || 0,
      firstPaint: fmp,
      firstContentfulPaint: fcp,
      timeToInteractive: tti,
      largestContentfulPaint: this.getLargestContentfulPaint(),
      totalBlockingTime: this.getTotalBlockingTime(),
    };

    this.pageMetrics.push(metrics);
    if (this.pageMetrics.length > this.maxMetrics) {
      this.pageMetrics = this.pageMetrics.slice(-this.maxMetrics);
    }

    // Send to backend for analytics
    this.sendMetricsToBackend('page-load', metrics);

    console.debug('Page load metrics:', metrics);
  }

  /**
   * Get Largest Contentful Paint
   */
  private getLargestContentfulPaint(): number {
    if (typeof window === 'undefined') return 0;

    try {
      const entries = performance.getEntriesByType('largest-contentful-paint') as any[];
      return entries.length > 0 ? entries[entries.length - 1].renderTime : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get Total Blocking Time
   */
  private getTotalBlockingTime(): number {
    if (typeof window === 'undefined') return 0;

    try {
      const entries = performance.getEntriesByType('longtask') as any[];
      return entries.reduce((sum, entry) => sum + (entry.duration - 50), 0);
    } catch {
      return 0;
    }
  }

  /**
   * Measure component render time
   */
  measureComponentRender(componentName: string, startTime: number): void {
    const duration = performance.now() - startTime;

    const metric: ComponentMetrics = {
      componentName,
      renderTime: duration,
      timestamp: Date.now(),
    };

    this.componentMetrics.push(metric);
    if (this.componentMetrics.length > this.maxMetrics) {
      this.componentMetrics = this.componentMetrics.slice(-this.maxMetrics);
    }

    if (duration > 100) {
      console.warn(`Slow component render: ${componentName} (${duration.toFixed(2)}ms)`);
    }
  }

  /**
   * Measure API call duration
   */
  measureAPICall(
    url: string,
    method: string,
    duration: number,
    statusCode: number,
    cacheHit: boolean = false
  ): void {
    const metric: APICallMetrics = {
      url,
      method,
      duration,
      statusCode,
      cacheHit,
      timestamp: Date.now(),
    };

    this.apiMetrics.push(metric);
    if (this.apiMetrics.length > this.maxMetrics) {
      this.apiMetrics = this.apiMetrics.slice(-this.maxMetrics);
    }

    if (duration > 500) {
      console.warn(`Slow API call: ${method} ${url} (${duration.toFixed(2)}ms)`);
    }

    this.sendMetricsToBackend('api-call', metric);
  }

  /**
   * Send metrics to backend
   */
  private sendMetricsToBackend(metricType: string, data: any): void {
    // Use beacon API for reliability
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/v1/metrics', JSON.stringify({ type: metricType, data }));
    } else {
      // Fallback to fetch (non-blocking)
      fetch('/api/v1/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: metricType, data }),
        keepalive: true,
      }).catch(() => {
        // Silently fail - don't disrupt app
      });
    }
  }

  /**
   * Get page metrics
   */
  getPageMetrics(): PageLoadMetrics[] {
    return [...this.pageMetrics];
  }

  /**
   * Get component metrics
   */
  getComponentMetrics(): ComponentMetrics[] {
    return [...this.componentMetrics];
  }

  /**
   * Get API metrics
   */
  getAPIMetrics(): APICallMetrics[] {
    return [...this.apiMetrics];
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const pageMetrics = this.pageMetrics.slice(-10); // Last 10 page loads
    const avgLoadTime =
      pageMetrics.length > 0
        ? pageMetrics.reduce((sum, m) => sum + m.loadTime, 0) / pageMetrics.length
        : 0;

    const slowComponents = this.componentMetrics
      .filter((m) => m.renderTime > 100)
      .sort((a, b) => b.renderTime - a.renderTime);

    const slowAPICalls = this.apiMetrics
      .filter((m) => m.duration > 500)
      .sort((a, b) => b.duration - a.duration);

    return {
      avgPageLoadTime: avgLoadTime,
      slowestComponent: slowComponents[0],
      slowestAPICall: slowAPICalls[0],
      apiCacheHitRate: this.calculateCacheHitRate(),
    };
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    if (this.apiMetrics.length === 0) return 0;

    const cacheHits = this.apiMetrics.filter((m) => m.cacheHit).length;
    return (cacheHits / this.apiMetrics.length) * 100;
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.pageMetrics = [];
    this.componentMetrics = [];
    this.apiMetrics = [];
  }
}

export const performanceMonitor = new FrontendPerformanceMonitor();

/**
 * Hook to measure component render time
 * Usage: const startTime = useComponentRenderTracker('ComponentName');
 */
export function useComponentRenderTracker(componentName: string) {
  const startTime = performance.now();

  return () => {
    performanceMonitor.measureComponentRender(componentName, startTime);
  };
}

/**
 * Hook for measuring mount/effect time
 */
export function useMountTime(componentName: string) {
  React.useEffect(() => {
    const trackRender = useComponentRenderTracker(componentName);
    return trackRender;
  }, []);
}

/**
 * Utility to wrap fetch for automatic metrics
 */
export async function fetchWithMetrics(url: string, options?: RequestInit) {
  const method = options?.method || 'GET';
  const startTime = Date.now();

  try {
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;

    const cacheHit = response.headers.get('etag') !== null;
    performanceMonitor.measureAPICall(url, method, duration, response.status, cacheHit);

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    performanceMonitor.measureAPICall(url, method, duration, 0, false);
    throw error;
  }
}

// Import React if available
let React: any;
try {
  React = require('react');
} catch {
  // Not in React environment
}
