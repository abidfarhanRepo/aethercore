/**
 * Request deduplication and API call optimization
 * Prevents duplicate in-flight requests and implements request caching
 */

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

/**
 * Simple request deduplicator
 * Merges identical concurrent requests into a single fetch
 */
class RequestDeduplicator {
  private pending: Map<string, PendingRequest> = new Map();
  private readonly DEFAULT_TTL = 5000; // 5 seconds

  /**
   * Get or fetch data
   * Deduplicates identical in-flight requests
   */
  async getOrFetch<T>(key: string, fn: () => Promise<T>, ttl: number = this.DEFAULT_TTL): Promise<T> {
    // Check if we already have a pending request
    const pending = this.pending.get(key);
    if (pending) {
      return pending.promise as Promise<T>;
    }

    // Create new request
    const promise = fn().then(
      (result) => {
        // Clean up after TTL
        setTimeout(() => {
          this.pending.delete(key);
        }, ttl);
        return result;
      },
      (error) => {
        // Clean up on error immediately
        this.pending.delete(key);
        throw error;
      }
    );

    this.pending.set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise as Promise<T>;
  }

  /**
   * Invalidate a pending request
   */
  invalidate(key: string): void {
    this.pending.delete(key);
  }

  /**
   * Invalidate all pending requests matching a pattern
   */
  invalidatePattern(pattern: RegExp): void {
    const keys = Array.from(this.pending.keys());
    keys.forEach((key) => {
      if (pattern.test(key)) {
        this.pending.delete(key);
      }
    });
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pending.clear();
  }
}

/**
 * API cache with TTL and invalidation
 * Stores API response data temporarily
 */
class APICache<T = any> {
  private cache: Map<string, { data: T; expiresAt: number }> = new Map();

  /**
   * Get cached data
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached data
   */
  set(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidatePattern(pattern: RegExp): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach((key) => {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Batch API request wrapper
 * Combines multiple requests into a single batch call
 */
class BatchRequestQueue {
  private queue: Array<{ key: string; fn: () => Promise<any>; resolve: Function; reject: Function }> = [];
  private batchSize: number;
  private batchTimeout: number;
  private processing = false;

  constructor(batchSize: number = 10, batchTimeout: number = 100) {
    this.batchSize = batchSize;
    this.batchTimeout = batchTimeout;
  }

  /**
   * Queue a request for batch processing
   */
  queue<T>(key: string, fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ key, fn, resolve, reject });

      if (this.queue.length >= this.batchSize) {
        this.processBatch();
      } else if (!this.processing) {
        setTimeout(() => {
          if (this.queue.length > 0) {
            this.processBatch();
          }
        }, this.batchTimeout);
      }
    });
  }

  /**
   * Process queued requests
   */
  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      const results = await Promise.allSettled(batch.map((item) => item.fn()));

      batch.forEach((item, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          item.resolve(result.value);
        } else {
          item.reject(result.reason);
        }
      });
    } finally {
      this.processing = false;

      // Process remaining items
      if (this.queue.length > 0) {
        this.processBatch();
      }
    }
  }

  /**
   * Cancel all queued requests
   */
  cancel(): void {
    this.queue.forEach((item) => {
      item.reject(new Error('Batch request cancelled'));
    });
    this.queue = [];
  }
}

/**
 * Abort controller helper for cancelling requests
 */
export class CancellableRequest {
  private controller: AbortController;

  constructor() {
    this.controller = new AbortController();
  }

  /**
   * Get abort signal for fetch
   */
  getSignal(): AbortSignal {
    return this.controller.signal;
  }

  /**
   * Cancel the request
   */
  cancel(): void {
    this.controller.abort();
  }

  /**
   * Check if cancelled
   */
  isCancelled(): boolean {
    return this.controller.signal.aborted;
  }
}

/**
 * Export singletons
 */
export const deduplicator = new RequestDeduplicator();
export const apiCache = new APICache();
export const batchQueue = new BatchRequestQueue();

/**
 * Example usage:
 *
 * // Deduplicate requests
 * const data = await deduplicator.getOrFetch('products', async () => {
 *   const res = await fetch('/api/products');
 *   return res.json();
 * });
 *
 * // Cache API responses
 * const getCachedProducts = async () => {
 *   const cached = apiCache.get('products');
 *   if (cached) return cached;
 *
 *   const response = await fetch('/api/products');
 *   const data = await response.json();
 *   apiCache.set('products', data, 5 * 60 * 1000); // Cache for 5 min
 *   return data;
 * };
 *
 * // Batch requests
 * const results = await Promise.all([
 *   batchQueue.queue('id1', () => fetch('/api/item/1')),
 *   batchQueue.queue('id2', () => fetch('/api/item/2')),
 *   batchQueue.queue('id3', () => fetch('/api/item/3')),
 * ]);
 */
