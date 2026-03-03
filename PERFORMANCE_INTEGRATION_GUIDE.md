# Integration Guide: Performance Optimization

## Quick Start - 10 Minutes

### 1. Update Configuration Files (2 min)
```bash
# Update Vite configuration
mv frontend/vite.config.optimized.ts frontend/vite.config.ts

# Update Service Worker
mv frontend/src/service-worker-optimized.ts frontend/src/service-worker.ts
```

### 2. Install Dependencies (3 min)
```bash
# Backend optimization dependencies
cd backend
npm install redis ioredis bulletmq

# Frontend optimization dependencies
cd ../frontend
npm install vite-plugin-visualizer --save-dev
```

### 3. Run Database Migration (2 min)
```bash
cd backend
npx prisma migrate deploy
# This creates all performance indexes
```

### 4. Verify Installation (3 min)
```bash
# Check backend metrics endpoint
curl http://localhost:4000/metrics

# Build and check bundle
cd frontend
npm run build
ls -lh dist/js/
```

## Step-by-Step Integration

### Backend Integration

#### 1. Update Main Server File (backend/src/index.ts)

Add these imports:
```typescript
import { compressionMiddleware } from './middleware/compression';
import { cacheHeadersMiddleware } from './middleware/caching';
import { performanceMonitoringHook, performanceMonitor } from './lib/performance';
import { rateLimiterHook } from './lib/rateLimiter';
import { initializeQueues } from './lib/queue';
```

Register middleware in your Fastify setup:
```typescript
const fastify = Fastify();

// Add compression
await compressionMiddleware(fastify, { level: 6 });

// Add cache headers
await cacheHeadersMiddleware(fastify);

// Add performance monitoring
await performanceMonitoringHook(fastify);

// Add rate limiting
await rateLimiterHook(fastify);

// Initialize job queues
await initializeQueues();
```

#### 2. Update Route Handlers

Use optimized queries:
```typescript
import { findProductsOptimized, findSalesOptimized } from './lib/queries';
import { getCacheManager } from './lib/caching';

fastify.get('/api/products', async (request, reply) => {
  const cache = getCacheManager();
  
  const result = await cache.getOrSet(
    'products:list',
    () => findProductsOptimized({ page: 1, limit: 50 }),
    3600 // 1 hour TTL
  );
  
  return result;
});
```

#### 3. Configure Environment Variables

Add to `.env`:
```
REDIS_URL=redis://localhost:6379
CACHE_ENABLED=true
COMPRESSION_ENABLED=true
RATE_LIMITING_ENABLED=true
```

### Frontend Integration

#### 1. Update App Structure

Use lazy loading for pages:
```typescript
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const Checkout = lazy(() => import('./pages/Checkout'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/checkout" element={<Checkout />} />
        </Routes>
      </Router>
    </Suspense>
  );
}
```

#### 2. Optimize Components

Use memoization:
```typescript
import { memo, useCallback, useMemo } from 'react';
import { withMemoization } from '@/lib/hooks/useOptimizedData';

const ProductTable = memo(function ProductTable({ products, onSelect }) {
  const handleSelectProduct = useCallback((product) => {
    onSelect(product);
  }, [onSelect]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  return (
    // Component JSX
  );
});

export default ProductTable;
```

#### 3. Use Optimized Data Hooks

```typescript
import { useOptimizedList, useDebounce } from '@/lib/hooks/useOptimizedData';

function ProductCatalog() {
  const [allProducts, setAllProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const { items, page, totalPages, goToPage } = useOptimizedList(
    allProducts,
    50
  );

  // Debounced search
  const debouncedQuery = useDebounce(searchQuery, 500);

  // Use virtual list for large datasets
  return (
    <>
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      
      {allProducts.length > 5000 ? (
        <VirtualProductListContainer
          products={items}
          height={600}
          onSelectProduct={handleSelect}
        />
      ) : (
        <ProductTable
          products={items}
          onSelect={handleSelect}
        />
      )}
      
      {/* Pagination controls */}
    </>
  );
}
```

#### 4. Track Performance

```typescript
import { performanceMonitor } from '@/lib/performance';
import { useComponentRenderTracker } from '@/lib/hooks/useOptimizedData';

function MyComponent() {
  // Track component render time
  const trackRender = useComponentRenderTracker('MyComponent');

  useEffect(() => {
    return trackRender();
  }, []);

  // Track API calls
  useEffect(() => {
    const startTime = Date.now();
    
    fetch('/api/data')
      .then(res => res.json())
      .then(data => {
        const duration = Date.now() - startTime;
        performanceMonitor.measureAPICall(
          '/api/data',
          'GET',
          duration,
          200,
          true
        );
      });
  }, []);

  return (
    // Component JSX
  );
}
```

### Database Integration

#### 1. Verify Indexes

```bash
cd backend

# Connect to database
psql $DATABASE_URL

# Check indexes created
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename;
```

#### 2. Analyze Query Performance

```typescript
import { explainQuery } from './lib/queries';

const plan = await explainQuery(`
  SELECT * FROM "Product" 
  WHERE "createdAt" > NOW() - INTERVAL '1 day'
  ORDER BY "createdAt" DESC
  LIMIT 50
`);

console.log('Query Plan:', plan);
```

### Monitoring Integration

#### 1. Access Metrics

```bash
# Get health summary
curl http://localhost:4000/metrics | jq

# Get per-endpoint stats
curl http://localhost:4000/metrics/endpoints | jq

# Get slow endpoints
curl http://localhost:4000/metrics/slow?threshold=500 | jq

# Export full metrics
curl http://localhost:4000/metrics/export | jq > metrics.json
```

#### 2. Set Up Dashboard

Create a monitoring dashboard:
```typescript
// backend/src/routes/monitoring.ts
import { performanceMonitor } from '../lib/performance';

export async function setupMonitoringRoutes(fastify) {
  fastify.get('/dashboard/performance', async (request, reply) => {
    return {
      health: performanceMonitor.getHealthSummary(),
      slowEndpoints: performanceMonitor.getSlowEndpoints(),
      errorEndpoints: performanceMonitor.getErrorEndpoints(),
      topEndpoints: performanceMonitor.getTopEndpoints(),
    };
  });
}
```

## Load Testing

### Run Backend Load Test

```bash
# Install k6
# On Mac: brew install k6
# On Windows: choco install k6

# Run test
k6 run infra/k6/backend-load-test.js

# With custom settings
k6 run --vus 100 --duration 5m infra/k6/backend-load-test.js
```

**Analyze Results**:
- Check p95/p99 latency (should be < 500ms/1s)
- Monitor error rate (should be < 1%)
- Verify throughput (should be > 1000 req/sec)

### Run Frontend Load Test

```bash
# Make sure frontend is running
cd frontend
npm run dev

# In another terminal
k6 run infra/k6/frontend-load-test.js
```

## Troubleshooting Integration

### Issue: Redis Connection Error

**Solution**:
```bash
# Start Redis
redis-server

# Or using Docker
docker run -d -p 6379:6379 redis:latest
```

### Issue: Database Migration Failed

**Solution**:
```bash
cd backend

# Check migration status
npx prisma migrate status

# Resolve conflicts then retry
npx prisma migrate deploy

# Or reset in dev
npx prisma migrate reset
```

### Issue: Bundle Size Not Reduced

**Solution**:
```bash
# Check vite config is using optimized version
cat frontend/vite.config.ts | grep manualChunks

# Rebuild from scratch
rm -rf frontend/dist
npm run build

# Analyze chunks
npm run build -- --analyze
```

### Issue: Cache Not Working

**Solution**:
1. Verify Redis is connected: `netstat -an | grep 6379`
2. Check cache headers: `curl -i http://localhost:4000/api/products`
3. Clear cache: `redis-cli FLUSHDB`
4. Review cache middleware registration

### Issue: Performance Metrics Not Available

**Solution**:
1. Verify middleware is registered in main server
2. Check route is exposed: `curl http://localhost:4000/metrics`
3. Review performance hook implementation
4. Check fastify version compatibility

## Validation Checklist

- [ ] Redis installed and running
- [ ] Database migration completed
- [ ] Backend Server starts without errors
- [ ] Frontend builds successfully
- [ ] Metrics endpoint responds
- [ ] Cache headers present in responses
- [ ] Code splitting observed in dist/js/
- [ ] Load test completes successfully
- [ ] No console errors in dev tools
- [ ] Service Worker registered

## Performance Expectations After Integration

### Immediate (~1 minute)
- ✓ Compression enabled
- ✓ Cache headers added
- ✓ Rate limiting active

### After 1 hour (cache warming)
- ✓ Cache hit rate > 50%
- ✓ Reduced response times
- ✓ Lower bandwidth usage

### After 24 hours (stabilization)
- ✓ Cache hit rate > 70%
- ✓ Stable baseline metrics
- ✓ Predictable performance

## Next Steps

1. **Monitor**: Check `/metrics` endpoint daily
2. **Tune**: Adjust cache TTLs based on usage patterns
3. **Scale**: Add Redis cluster for distributed caching
4. **Alert**: Set up monitoring alerts for anomalies
5. **Document**: Update team runbooks with new procedures

## Support Resources

- Performance Guide: [PERFORMANCE.md](PERFORMANCE.md)
- Integration Issues: Check [OPTIMIZATION_CHECKLIST.md](OPTIMIZATION_CHECKLIST.md)
- API Examples: Check backend/src/lib/ files
- Frontend Examples: Check frontend/src/lib/ files

---

**Time to Full Integration**: ~30 minutes
**Production Deployment Time**: ~15 minutes
**Rollback Time**: ~5 minutes (just revert commits)
