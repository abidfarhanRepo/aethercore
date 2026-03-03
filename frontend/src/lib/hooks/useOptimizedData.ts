import React, { useMemo, useCallback } from 'react';

/**
 * Custom hooks for optimized data handling
 * Prevents unnecessary re-renders and optimizes expensive calculations
 */

/**
 * Memoized data selector hook
 * Prevents component re-render if data reference hasn't changed
 */
export function useOptimizedData<T>(
  data: T,
  dependencies: React.DependencyList = []
): T {
  return useMemo(() => data, [JSON.stringify(data), ...dependencies]);
}

/**
 * Hook for list data with memoization and pagination
 */
export function useOptimizedList<T>(
  items: T[],
  pageSize: number = 50
) {
  const [page, setPage] = React.useState(1);

  const paginatedItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return items.slice(startIndex, endIndex);
  }, [items, page, pageSize]);

  const totalPages = useMemo(() => Math.ceil(items.length / pageSize), [items.length, pageSize]);

  const goToPage = useCallback((newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)));
  }, [totalPages]);

  const goToNextPage = useCallback(() => goToPage(page + 1), [page, goToPage]);
  const goToPreviousPage = useCallback(() => goToPage(page - 1), [page, goToPage]);

  return {
    items: paginatedItems,
    page,
    totalPages,
    goToPage,
    goToNextPage,
    goToPreviousPage,
  };
}

/**
 * Debounce hook for expensive operations
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle hook for frequent updates
 */
export function useThrottle<T>(value: T, interval: number = 500): T {
  const [throttledValue, setThrottledValue] = React.useState<T>(value);
  const lastUpdated = React.useRef(Date.now());

  React.useEffect(() => {
    const now = Date.now();

    if (now >= lastUpdated.current + interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const handler = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval - (now - lastUpdated.current));

      return () => clearTimeout(handler);
    }
  }, [value, interval]);

  return throttledValue;
}

/**
 * Memoized callback hook for stable function references
 */
export function useOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  dependencies?: React.DependencyList
): T {
  return useCallback(callback, dependencies) as T;
}

/**
 * Memoized array hook
 */
export function useOptimizedArray<T>(array: T[]): T[] {
  return useMemo(() => array, [JSON.stringify(array)]);
}

/**
 * Memoized object hook
 */
export function useOptimizedObject<T extends Record<string, any>>(object: T): T {
  return useMemo(() => object, [JSON.stringify(object)]);
}

/**
 * Hook to track component render count
 */
export function useRenderCount(componentName?: string) {
  const renderCount = React.useRef(0);

  React.useEffect(() => {
    renderCount.current++;
    if (process.env.NODE_ENV === 'development') {
      console.debug(`${componentName || 'Component'} rendered ${renderCount.current} times`);
    }
  });

  return renderCount.current;
}

/**
 * Hook to measure hook execution time
 */
export function usePerformanceTracker(hookName: string) {
  const startTime = React.useRef(Date.now());

  React.useEffect(() => {
    const duration = Date.now() - startTime.current;
    if (process.env.NODE_ENV === 'development') {
      console.debug(`${hookName} execution took ${duration}ms`);
    }
  }, []);
}

/**
 * Higher-order component for memoization
 */
export const withMemoization = <
  P extends Record<string, any>,
  T extends (props: P) => React.ReactElement
>(
  Component: T,
  arePropsEqual?: (prevProps: P, nextProps: P) => boolean
) => {
  return React.memo(Component, arePropsEqual);
};

/**
 * Hook for memoized filter/map operations on arrays
 */
export function useOptimizedFilter<T>(
  items: T[],
  predicate: (item: T) => boolean,
  dependencies?: React.DependencyList
): T[] {
  return useMemo(() => items.filter(predicate), [items, ...(dependencies || [])]);
}

export function useOptimizedMap<T, U>(
  items: T[],
  mapper: (item: T) => U,
  dependencies?: React.DependencyList
): U[] {
  return useMemo(() => items.map(mapper), [items, ...(dependencies || [])]);
}

/**
 * Hook for reducing expensive computations
 */
export function useOptimizedReduce<T, R>(
  items: T[],
  reducer: (acc: R, item: T) => R,
  initialValue: R,
  dependencies?: React.DependencyList
): R {
  return useMemo(
    () => items.reduce(reducer, initialValue),
    [items, initialValue, ...(dependencies || [])]
  );
}

/**
 * Hook for lazy loading data
 */
export function useLazyLoad<T>(
  loadFn: () => Promise<T>,
  dependencies?: React.DependencyList
) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, dependencies || []);

  return { data, loading, error, load };
}
