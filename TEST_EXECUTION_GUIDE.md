# Aether POS - Test Execution Guide

## Quick Start

### Prerequisites
```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### Run All Tests
```bash
# Backend tests
cd backend
npm run test              # All tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only

# Frontend tests
cd ../frontend
npm run test              # All tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report

# E2E tests
npm run test:e2e         # Playwright tests
npm run test:e2e:ui      # With Playwright UI

# Load tests
cd ../infra
npm run test:load        # k6 load tests
```

## Test Environment Setup

### Backend Test Database
```bash
# Create test database (one-time)
createdb aether-pos-test

# Create .env.test file
cat > backend/.env.test << EOF
DATABASE_URL=postgresql://user:password@localhost:5432/aether-pos-test
NODE_ENV=test
JWT_ACCESS_SECRET=test-secret-access
JWT_REFRESH_SECRET=test-secret-refresh
EOF

# Run migrations
npm run migrate:test
```

### Frontend Test Configuration
- Jest uses jsdom for DOM simulation
- MSW (Mock Service Worker) for API mocking
- Tests don't require running backend

## Unit Tests: Execution

### Backend Unit Tests
```bash
cd backend
npm run test -- authService.test.ts
npm run test -- --testPathPattern=unit
npm run test:coverage -- --collectCoverageFrom='src/**/*.ts'
```

**Expected Output**:
```
Test Suites: 4 passed, 4 total
Tests:       200+ passed, 200+ total
Coverage:    85%+ statements, branches, functions, lines
Time:        3-5 seconds
```

### Frontend Unit Tests
```bash
cd frontend
npm run test -- Login.test.tsx
npm run test -- --testPathPattern=unit
npm run test:coverage
```

**Expected Output**:
```
Test Suites: 3 passed, 3 total
Tests:       150+ passed, 150+ total
Coverage:    80%+ statements, branches, functions, lines
Time:        2-3 seconds
```

## Integration Tests: Execution

### Backend Integration Tests
```bash
cd backend

# Reset test database
npm run test:reset

# Run all integration tests
npm run test:integration

# Run specific suite
npm run test -- auth.integration.test.ts

# With coverage
npm run test:integration -- --coverage
```

**Expected Output**:
```
Test Suites: 4 passed, 4 total
Tests:       1200+ passed, 1200+ total
Tests Affected by Database State: 0
Time:        10-15 seconds
```

### Frontend Integration Tests
```bash
cd frontend
npm run test -- --testPathPattern=integration
npm run test:coverage -- --testPathPattern=integration
```

## E2E Tests: Execution

### Playwright Setup (One-time)
```bash
cd frontend
npm install playwright
npx playwright install
```

### Run E2E Tests
```bash
# All browsers (Chromium, Firefox, WebKit)
npm run test:e2e

# Single browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Single test file
npx playwright test tests/e2e/login.spec.ts

# With UI (visual debugging)
npm run test:e2e:ui

# With debugging
npx playwright test --debug

# Generate report
npm run test:e2e:report
```

**Expected Output**:
```
✓ tests/e2e/login.spec.ts (3 tests)
✓ tests/e2e/checkout.spec.ts (5 tests)
✓ tests/e2e/inventory.spec.ts (4 tests)
✓ tests/e2e/reports.spec.ts (3 tests)

Total: 15 passed, 0 failed
Time: 60-90 seconds
```

## Performance/Load Testing

### k6 Load Testing
```bash
cd infra

# Install k6 (Windows)
choco install k6

# Run checkout load test
k6 run load-tests/k6-checkout-test.js

# Run product list test
k6 run load-tests/k6-product-list-test.js

# Run inventory test
k6 run load-tests/k6-inventory-test.js

# With custom settings
k6 run -e USERS=200 -e DURATION=300s load-tests/k6-checkout-test.js
```

**Expected Output**:
```
iterations: 450 avg: 280ms min: 85ms max: 890ms p(90): 450ms p(95): 650ms p(99): 850ms
data_received.: 2.5 MB
data_sent.....: 1.2 MB
http_reqs.....: 1200 reqs/sec
http_errors...: 0 errors
```

## Security Testing

### Local Security Scans
```bash
# Dependency audit
npm audit
npm audit --fix

# Snyk scan (requires account)
npm install -g snyk
snyk test

# OWASP ZAP scan
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:4000

# Container image scan
docker build -t aether-pos:test .
trivy image aether-pos:test

# Docker container CIS Benchmark
docker run --rm --net host aqua/trivy config .
```

## Accessibility Testing

### Automated Accessibility Checks
```bash
# Install tools
npm install -D @axe-core/webdriverio

# Run Lighthouse
npm run lighthouse

# Run axe-DevTools (browser extension)
# Manual: Install from Chrome Web Store, run on frontend URLs

# Run WAVE (browser extension)
# Manual: Install from Chrome Web Store, run on frontend URLs
```

## Test Coverage Analysis

### Generate Coverage Report
```bash
cd backend
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Requirements by File
```
src/services/auth.ts:       90%+ (security critical)
src/services/sales.ts:      88%+ (business critical)
src/services/inventory.ts:  85%+ (data critical)
src/services/reports.ts:    85%+ (analytics)
src/routes/**/*.ts:         80%+ (API endpoints)
```

### Enforce Minimum Coverage
```bash
# Fail if coverage <80%
npm run test:coverage -- --threshold 80

# Coverage trending
npx jest-html-reporter --outputPath=coverage/report.html
```

## Regression Testing

### Pre-Release Regression Suite
```bash
# 1. Run all unit tests
npm run test

# 2. Run all integration tests
npm run test:integration

# 3. Run all E2E tests
npm run test:e2e

# 4. Run security scans
npm audit
snyk test

# 5. Run performance baseline
npm run test:load -- --vus 100 --duration 300s

# All in one command
npm run test:full
```

### Manual Smoke Tests
1. Login as admin/manager/cashier
2. Create a complete sale (add items, apply discount, checkout)
3. Verify inventory was updated
4. Generate daily sales report
5. Apply refund to previous sale
6. Verify offline sync (if applicable)

## UAT Execution

### Test Case Execution
```bash
# 1. Set up test environment
npm run setup:test

# 2. Provide credentials to stakeholders
User: uat@test.com
Pass: UAT_TestPass_123

# 3. Provide test data
See: docs/UAT_TEST_DATA.md

# 4. Collect results
Use: templates/UAT_TEST_RESULT.md

# 5. Verify sign-off
- Product Owner approval
- Store Manager confirmation
- No critical issues
```

## CI/CD Integration

### GitHub Actions Example
```yaml
# Every commit
- Run unit tests
- Check coverage ≥80%

# Every pull request
- All unit tests
- All integration tests
- Coverage report

# Before merge
- E2E tests
- Security scan
- Performance regression

# Pre-release
- Full test suite
- UAT approval
- Regression suite
- Sign-off gates
```

## Troubleshooting

### Tests Failing
```bash
# Check Node version
node --version  # Should be 18+

# Check dependencies
npm list

# Clear cache and reinstall
rm -rf node_modules
npm install

# Reset test database
npm run test:reset

# Run with verbose logging
npm run test -- --verbose
```

### Performance Issues
```bash
# Slow tests
npm run test -- --detectOpenHandles

# Memory leaks
npm run test -- --forceExit

# Database deadlocks
# Ensure test isolation and proper transaction rollback
```

### E2E Test Flakiness
```bash
# Use explicit waits
page.waitForSelector('#element')
page.waitForNavigation()

# Increase timeouts for slow machines
npx playwright test --timeout 30000

# Run in serial instead of parallel
npx playwright test --workers=1
```

## Test Maintenance

### Keep Tests Updated
- Review tests when updating corresponding code
- Remove tests for removed features
- Update mocks when API contracts change
- Refresh test data as schemas evolve

### Performance Optimization
- Mock expensive operations
- Use smaller datasets in unit tests
- Run integration tests in parallel
- Cache test data when possible

### Test Documentation
- Comment complex test setup
- Document fixture dependencies
- Explain non-obvious assertions
- Link to feature requirements

## Continuous Monitoring

### Test Health Dashboard
```bash
# Generate metrics
npm run test:metrics

# Trending
- Coverage trending over time
- Test execution time
- Pass/fail ratio
- Defect escape rate
```

### Quality Gates
```
✅ Coverage ≥80%  → Allow commit
❌ Coverage <80%  → Block commit

✅ All tests pass → Allow merge
❌ Tests fail    → Block merge

✅ Security OK   → Approve release
❌ Issues found  → Block release
```

## Success Metrics

After full test implementation:
- ✅ All test suites execute in <45 minutes
- ✅ 85%+ code coverage achieved
- ✅ <1% defect escape rate
- ✅ 99%+ test pass rate
- ✅ 100% critical path coverage
- ✅ <100ms average test execution
