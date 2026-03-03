# Aether POS - Regression Test Suite

## Overview
Automated regression testing to prevent reintroduction of previously fixed bugs and verify critical functionality after each release.

## Pre-Release Regression Checklist

### Tier 1: Critical Workflows (Must Pass)
Every release must demonstrate these core workflows function correctly:

- [ ] **User Authentication**
  - [ ] Register new user account
  - [ ] Login with valid credentials
  - [ ] Login fails with invalid password
  - [ ] Account lockout after 5 failures
  - [ ] Logout clears session
  - [ ] Password reset email received
  - [ ] Password reset works
  - [ ] Tokens refresh automatically
  - [ ] Session expires after timeout

- [ ] **Complete Sales Transaction**
  - [ ] Add product to cart
  - [ ] Remove product from cart
  - [ ] Update product quantity
  - [ ] View cart total
  - [ ] Apply percentage discount (e.g., 10%)
  - [ ] Apply fixed discount (e.g., $5 off)
  - [ ] Apply bulk discount
  - [ ] Valid discount calculation
  - [ ] Tax calculation correct
  - [ ] Final total correct
  - [ ] Select payment method
  - [ ] Process payment
  - [ ] Payment confirmation shown
  - [ ] Receipt generated and printable
  - [ ] Sale recorded in database

- [ ] **Inventory Management**
  - [ ] View product inventory
  - [ ] Adjust stock quantity
  - [ ] Stock cannot go negative
  - [ ] Stock reduced after sale
  - [ ] Transfer between locations
  - [ ] Low stock alert triggers
  - [ ] Inventory history tracked
  - [ ] Stock available shows correctly

- [ ] **Refunds & Returns**
  - [ ] Create refund for transaction
  - [ ] Refund amount calculated correctly
  - [ ] Inventory restored after refund
  - [ ] Return items to inventory
  - [ ] Return documentation created
  - [ ] Return status tracked

- [ ] **Reporting**
  - [ ] Generate daily sales report
  - [ ] Daily report shows correct totals
  - [ ] Generate product report
  - [ ] Report filters work (date, product, location)
  - [ ] Export report to CSV
  - [ ] Export report to PDF
  - [ ] Chart visualizations display
  - [ ] Revenue calculations correct
  - [ ] Profit margin calculations correct

- [ ] **Permissions & Security**
  - [ ] Admin can access admin panel
  - [ ] Manager can access manager functions
  - [ ] Cashier can only access POS
  - [ ] Regular user cannot access admin
  - [ ] Each user sees only their data
  - [ ] Users cannot modify other users' data
  - [ ] API validates permissions on each endpoint

### Tier 2: Core Features (Should Pass)
- [ ] Search products functionality
- [ ] Filter by category
- [ ] Sort by price/name/popularity
- [ ] Pagination works (10, 25, 50 items per page)
- [ ] User management (create, edit, delete)
- [ ] Store location management
- [ ] Product catalog management
- [ ] Bulk actions (select multiple)
- [ ] Mass import/export
- [ ] Settings/configuration changes
- [ ] Notification system
- [ ] Scheduled reports
- [ ] Data backup functionality

### Tier 3: UI/UX (Should Pass)
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Form validation shows correct messages
- [ ] Error messages are helpful
- [ ] Success messages display
- [ ] Loading indicators show
- [ ] Modal dialogs work correctly
- [ ] Dropdowns function properly
- [ ] Date picker works
- [ ] Time picker works
- [ ] Number input handles decimals
- [ ] Currency formatting correct
- [ ] Date formatting matches locale
- [ ] Print preview shows correctly
- [ ] Keyboard navigation works
- [ ] Tab order is logical
- [ ] Focus indicators visible

### Tier 4: Performance (Should Pass)
- [ ] Page load time <3 seconds
- [ ] Search results <500ms
- [ ] Report generation <5 seconds
- [ ] No noticeable lag on interactions
- [ ] Smooth scrolling
- [ ] Animations smooth (60fps)
- [ ] Charts render quickly
- [ ] Forms submit without delay
- [ ] PDF export completes <10 seconds

## Automated Regression Test Suite

### E2E Tests - Login Flow
```typescript
describe('Login Regression Suite', () => {
  test('user can login with valid credentials', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.fill('#email', 'cashier@test.com');
    await page.fill('#password', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    expect(page.url()).toContain('/dashboard');
  });

  test('account locks after 5 failed attempts', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.goto('http://localhost:5173/login');
      await page.fill('#email', 'cashier@test.com');
      await page.fill('#password', 'WrongPassword');
      await page.click('button[type="submit"]');
    }
    // 6th attempt
    await page.goto('http://localhost:5173/login');
    await page.fill('#email', 'cashier@test.com');
    await page.fill('#password', 'TestPass123!');
    await page.click('button[type="submit"]');
    const error = await page.locator('text=Account locked').first();
    expect(error).toBeVisible();
  });

  test('session expires after timeout', async ({ page }) => {
    // Login
    await page.goto('http://localhost:5173/login');
    await page.fill('#email', 'cashier@test.com');
    await page.fill('#password', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    // Wait for token expiry (simulate 15 min)
    await page.context().clearCookies();
    await page.reload();
    expect(page.url()).toContain('/login');
  });
});
```

### E2E Tests - Sales Workflow
```typescript
describe('Sales Transaction Regression Suite', () => {
  test('complete sale from start to finish', async ({ page }) => {
    // Login
    await loginAs(page, 'cashier@test.com', 'TestPass123!');

    // Add items to cart
    await page.click('text=Start Sale');
    await page.click('button:has-text("Laptop")');
    let quantity = await page.inputValue('#quantity');
    expect(quantity).toBe('1');

    // Apply discount
    await page.fill('#discountCode', 'SAVE10');
    await page.click('button:has-text("Apply")');
    const discount = await page.locator('text=Discount: $').first();
    expect(discount).toBeVisible();

    // Checkout
    await page.click('button:has-text("Checkout")');
    await page.selectOption('#paymentMethod', 'card');
    await page.click('button:has-text("Process Payment")');

    // Verify receipt
    expect(page.url()).toContain('/receipt');
    const receipt = await page.locator('text=Receipt').first();
    expect(receipt).toBeVisible();
  });

  test('tax calculation is accurate', async ({ page }) => {
    await loginAs(page, 'cashier@test.com', 'TestPass123!');
    await page.goto('http://localhost:5173/pos');

    // Add item ($100)
    await page.click('button:has-text("Product1")');

    // Tax should be $10 (assuming 10% tax)
    const tax = await page.locator('text=Tax:').first();
    expect(tax).toContainText('$10.00');

    // Total should be $110
    const total = await page.locator('text=Total:').first();
    expect(total).toContainText('$110.00');
  });
});
```

### Unit Tests - Core Functions
```typescript
describe('Sales Service Regression', () => {
  test('discount calculation - percentage', () => {
    const subtotal = 100;
    const discount = calculateDiscount(subtotal, { type: 'percentage', value: 10 });
    expect(discount).toBe(10);
  });

  test('discount calculation - fixed amount', () => {
    const subtotal = 100;
    const discount = calculateDiscount(subtotal, { type: 'fixed', value: 5 });
    expect(discount).toBe(5);
  });

  test('tax calculation with standard rate', () => {
    const subtotal = 100;
    const tax = calculateTax(subtotal, 0.1);
    expect(tax).toBe(10);
  });

  test('total calculation sums correctly', () => {
    const subtotal = 100;
    const discount = 10;
    const tax = 9;
    const total = calculateTotal(subtotal, discount, tax);
    expect(total).toBe(99);
  });

  test('change calculation is correct', () => {
    const total = 99;
    const paid = 100;
    const change = calculateChange(total, paid);
    expect(change).toBe(1);
  });
});
```

### Integration Tests - Critical Paths
```typescript
describe('Inventory Service Regression', () => {
  test('stock reduced after sale', async () => {
    // Setup: Product with 10 items
    const product = await createProduct({ name: 'Widget', stock: 10 });

    // Sale: Sell 3 items
    await createSale({ productId: product.id, quantity: 3 });

    // Verify: Stock is now 7
    const updated = await getProduct(product.id);
    expect(updated.stock).toBe(7);
  });

  test('negative stock prevented', async () => {
    const product = await createProduct({ name: 'Widget', stock: 5 });

    // Try to sell 10
    const sale = await createSale({
      productId: product.id,
      quantity: 10
    });

    // Should fail
    expect(sale.error).toBe('Insufficient stock');
    
    // Stock unchanged
    const check = await getProduct(product.id);
    expect(check.stock).toBe(5);
  });

  test('stock restored on refund', async () => {
    const product = await createProduct({ name: 'Widget', stock: 10 });
    const sale = await createSale({ productId: product.id, quantity: 3 });
    const checkBefore = await getProduct(product.id);
    expect(checkBefore.stock).toBe(7);

    // Refund
    await createRefund({ saleId: sale.id });

    // Stock should be 10 again
    const checkAfter = await getProduct(product.id);
    expect(checkAfter.stock).toBe(10);
  });
});
```

## Manual Regression Test Cases

### Test Case: End-to-End Sale
**ID**: REG-001  
**Steps**:
1. Login as cashier
2. Click "Start Sale"
3. Add 3 different products
4. Apply discount code "SAVE10" (10% discount)
5. Select payment method "Cash"
6. Click "Process Payment"
7. Verify receipt prints

**Expected Results**:
- Sale created in database
- Inventory reduced for each product
- Discount applied correctly
- Tax calculated correctly
- Receipt generated
- Receipt printable

### Test Case: Refund Processing
**ID**: REG-002  
**Steps**:
1. Login as manager
2. Go to "Sales" menu
3. Find today's sales
4. Click top sale
5. Click "Create Refund"
6. Review refund amount
7. Click "Process Refund"

**Expected Results**:
- Refund amount correct
- Inventory items restored
- Refund recorded
- Customer balance updated
- Email confirmation sent

### Test Case: Report Generation
**ID**: REG-003  
**Steps**:
1. Login as admin
2. Go to "Reports"
3. Select "Daily Sales"
4. Choose date range (today)
5. Click "Generate"
6. Click "Export CSV"
7. Verify file downloads

**Expected Results**:
- Report loads
- Data accurate
- All products listed with sales
- Totals calculated correctly
- CSV file valid
- Can open in Excel

### Test Case: User Permission Check
**ID**: REG-004  
**Steps**:
1. Login as cashier
2. Try to access /admin/users
3. Try to access /reports/admin
4. Logout, login as manager
5. Access /reports/sales (should work)
6. Try /admin/users (should fail)

**Expected Results**:
- Cashier blocked from admin
- Manager can view their reports
- Each role sees appropriate menus
- API returns 403 with 401 for missing auth

## Browser-Specific Regression Tests

### Safari Specific
- [ ] Date picker works without fallback library
- [ ] WebGL charts render correctly
- [ ] Print CSS displays correctly
- [ ] Keyboard input smooth
- [ ] Touch events work on trackpad
- [ ] Form autofill functions

### Firefox Specific
- [ ] CSS Grid displays correctly
- [ ] SVG rendering quality
- [ ] File upload works
- [ ] IndexedDB operations smooth
- [ ] WebGL performance acceptable

### Mobile Specific
- [ ] Responsive layout on 320px screen
- [ ] Touch targets ≥48px
- [ ] Mobile keyboard doesn't hide content
- [ ] Landscape orientation works
- [ ] Offline mode functions
- [ ] Page transitions smooth

## Performance Regression Tests

### Load Time Regression
```javascript
// Measure key metrics
test('Page load performance maintained', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('http://localhost:5173/pos');
  await page.waitForLoadState('networkidle');
  const duration = Date.now() - startTime;
  
  // Should not exceed baseline + 10%
  expect(duration).toBeLessThan(3300); // 3s baseline + 10%
});
```

### Database Query Performance
```typescript
test('product search <500ms', async () => {
  const start = Date.now();
  const results = await searchProducts({ query: 'laptop' });
  const duration = Date.now() - start;
  
  expect(duration).toBeLessThan(500);
  expect(results.length).toBeGreaterThan(0);
});
```

## Regression Test Automation

### Pre-Merge Regression Check
```bash
#!/bin/bash
# Run critical regression suite before merge

echo "Running Regression Test Suite..."

# Unit tests
npm run test -- --testPathPattern="(auth|sales|inventory|report)" || exit 1

# Integration critical paths
npm run test:integration || exit 1

# E2E critical workflows
npm run test:e2e -- --project=chromium || exit 1

echo "✅ All regression tests passed!"
```

### Pre-Release Regression Check
```bash
#!/bin/bash
# Full regression suite before release

echo "Running Full Regression Suite..."

# All unit tests
npm run test || exit 1

# All integration tests
npm run test:integration || exit 1

# All E2E tests (all browsers)
npm run test:e2e || exit 1

# Run load tests
npm run test:load || exit 1

# Security scan
npm audit || exit 1

# Accessibility scan
npm run test:accessibility || exit 1

echo "✅ Full regression suite passed!"
echo "Ready for release!"
```

## Defect Regression Prevention

### When Defect Fixed
1. Create test that reproduces defect
2. Verify test fails with old code
3. Apply fix
4. Verify test passes
5. Add test to regression suite
6. Test remains in suite permanently

### Example: Discount Rounding Bug
```typescript
// Bug: Discount not rounding correctly (showed $9.99999)
test('discount displays with correct rounding', () => {
  const discount = calculateDiscount(99.99, { type: 'percentage', value: 10 });
  // Should be exactly $10.00, not $9.99999
  expect(discount).toBe(10.00);
  expect(discount.toFixed(2)).toBe('10.00');
});
```

## Metrics & Trending

### Track These Metrics
- Regression test pass rate (target: 100%)
- Build time (target: <10 minutes)
- Defect escape rate (target: <1%)
- Defects found in regression vs production (target: catch 99%)

### Quarterly Review
- New defects escape rate: Should decrease
- Regression suite coverage: Should increase
- Test execution time: Should remain stable
- Test maintenance burden: Should be manageable

## Sign-Off Checklist

Before every release:
```
Regression Test Results:
✅ All Tier 1 tests pass (critical workflows)
✅ All Tier 2 tests pass (core features)
✅ All Tier 3 tests pass (UI/UX)
✅ All Tier 4 tests pass (performance)
✅ No new defects introduced
✅ No previously-fixed defects reappeared
✅ All browsers pass regression suite
✅ Mobile regression tests pass
✅ Performance metrics within baseline
✅ Zero critical/high defects
✅ QA team sign-off
✅ Product owner approval
```

Ready for release? ✅ **YES** / ❌ **NO**
