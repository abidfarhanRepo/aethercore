/**
 * Backend load testing with k6
 * Run with: k6 run backend/load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up
    { duration: '1m30s', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.1'], // Error rate < 10%
  },
};

const BASE_URL = 'http://localhost:4000';
const API_KEY = 'test-api-key';

/**
 * Setup - run once before test
 */
export function setup() {
  // Login and get auth token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'cashier@example.com',
    password: 'password123',
  });

  const token = loginRes.json('access_token');
  console.log('Setup complete, token:', token);

  return {
    token,
  };
}

/**
 * Main test function
 */
export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Test 1: Get products list
  {
    const res = http.get(`${BASE_URL}/api/products?page=1&limit=50`, {
      headers,
    });

    check(res, {
      'products - status is 200': (r) => r.status === 200,
      'products - response time < 100ms': (r) => r.timings.duration < 100,
      'products - has data': (r) => r.json('data').length > 0,
    });
  }

  sleep(1);

  // Test 2: Get single product
  {
    const res = http.get(`${BASE_URL}/api/products/1`, {
      headers,
    });

    check(res, {
      'single product - status is 200': (r) => r.status === 200,
      'single product - response time < 50ms': (r) => r.timings.duration < 50,
    });
  }

  sleep(1);

  // Test 3: Get inventory
  {
    const res = http.get(`${BASE_URL}/api/inventory?page=1&limit=100`, {
      headers,
    });

    check(res, {
      'inventory - status is 200': (r) => r.status === 200,
      'inventory - response time < 200ms': (r) => r.timings.duration < 200,
    });
  }

  sleep(1);

  // Test 4: Get sales list
  {
    const res = http.get(`${BASE_URL}/api/sales?page=1&limit=50`, {
      headers,
    });

    check(res, {
      'sales - status is 200': (r) => r.status === 200,
      'sales - response time < 150ms': (r) => r.timings.duration < 150,
    });
  }

  sleep(1);

  // Test 5: Get user data
  {
    const res = http.get(`${BASE_URL}/api/user/profile`, {
      headers,
    });

    check(res, {
      'user profile - status is 200': (r) => r.status === 200,
      'user profile - response time < 50ms': (r) => r.timings.duration < 50,
    });
  }

  sleep(2);
}

/**
 * Teardown - run once after test
 */
export function teardown(data) {
  console.log('Test complete');
}
