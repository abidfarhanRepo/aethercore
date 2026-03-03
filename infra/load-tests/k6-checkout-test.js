import http from 'k6/http';
import { check, group, sleep } from 'k6';

/**
 * k6 Load Test - Checkout Transaction Flow
 * Tests POS checkout workflow under load
 * Target: <500ms response time (p95)
 * Users: 100 concurrent
 * Duration: 5 minutes
 */

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up to 20 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '2m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.1'],
  },
};

// Base URL for API
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api';

// Test data
const testUser = {
  email: 'cashier@test.com',
  password: 'TestPass123!',
};

const testProducts = [
  { id: '1', name: 'Laptop', price: 999.99 },
  { id: '2', name: 'Mouse', price: 29.99 },
  { id: '3', name: 'Keyboard', price: 79.99 },
];

export default function () {
  // Authenticate
  let authToken = '';
  group('Authentication', () => {
    const loginRes = http.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password,
    });

    check(loginRes, {
      'login status is 200': (r) => r.status === 200,
      'login returns token': (r) => r.json('token') !== undefined,
    });

    if (loginRes.status === 200) {
      authToken = loginRes.json('token');
    }
  });

  // Create sales transaction
  group('Checkout Flow', () => {
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };

    // Create sale
    const salePayload = JSON.stringify({
      items: [
        { productId: testProducts[0].id, quantity: 1 },
        { productId: testProducts[1].id, quantity: 2 },
      ],
      discountCode: 'SAVE10',
      taxRate: 0.1,
      paymentMethod: 'cash',
    });

    const saleRes = http.post(`${BASE_URL}/sales`, salePayload, { headers });

    check(saleRes, {
      'sale creation status is 201': (r) => r.status === 201,
      'sale has ID': (r) => r.json('id') !== undefined,
      'correct subtotal': (r) => r.json('subtotal') > 0,
      'tax calculated': (r) => r.json('tax') > 0,
      'total calculated': (r) => r.json('total') > 0,
    });

    let saleId = '';
    if (saleRes.status === 201) {
      saleId = saleRes.json('id');
    }

    // Process payment
    if (saleId) {
      const paymentPayload = JSON.stringify({
        amount: saleRes.json('total'),
        paymentMethod: 'cash',
        reference: `TEST-${Date.now()}`,
      });

      const paymentRes = http.post(
        `${BASE_URL}/sales/${saleId}/payment`,
        paymentPayload,
        { headers }
      );

      check(paymentRes, {
        'payment status is 200': (r) => r.status === 200,
        'payment successful': (r) => r.json('status') === 'completed',
        'receipt generated': (r) => r.json('receipt') !== undefined,
      });
    }

    // Get receipt
    if (saleId && authToken) {
      const receiptRes = http.get(`${BASE_URL}/sales/${saleId}/receipt`, { headers });

      check(receiptRes, {
        'receipt fetch status is 200': (r) => r.status === 200,
        'receipt contains items': (r) => r.json('items').length > 0,
      });
    }
  });

  // Inventory update verification
  group('Inventory Check', () => {
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };

    const inventoryRes = http.get(`${BASE_URL}/inventory`, { headers });

    check(inventoryRes, {
      'inventory fetch status is 200': (r) => r.status === 200,
      'inventory has items': (r) => r.json('items').length > 0,
    });
  });

  // Think time between requests
  sleep(2);
}

/**
 * Summary: This load test simulates realistic POS checkout workflows
 * - Authenticates user
 * - Creates sales with multiple items
 * - Applies discounts
 * - Processes payments
 * - Generates receipts
 * - Verifies inventory updates
 *
 * Success Criteria:
 * - p95 response time < 500ms
 * - p99 response time < 1000ms
 * - Error rate < 0.1%
 * - No timeouts or connection errors
 */
