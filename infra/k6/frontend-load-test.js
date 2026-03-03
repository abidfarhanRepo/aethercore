/**
 * Frontend load testing with k6
 * Tests frontend performance under load
 * Run with: k6 run frontend/load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 50 }, // Ramp up
    { duration: '1m', target: 100 },
    { duration: '1m30s', target: 100 }, // Stay at peak
    { duration: '20s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<3000'], // Page loads
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = 'http://localhost:5173';

/**
 * Home page load test
 */
export default function () {
  // Load home page
  {
    const res = http.get(BASE_URL);

    check(res, {
      'home - status is 200': (r) => r.status === 200,
      'home - response time < 2s': (r) => r.timings.duration < 2000,
    });
  }

  sleep(1);

  // Load app (SPA)
  {
    const res = http.get(`${BASE_URL}/dashboard`, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    check(res, {
      'app - status is 200': (r) => r.status === 200,
      'app - response time < 1s': (r) => r.timings.duration < 1000,
    });
  }

  sleep(1);

  // Simulate user interaction
  {
    const res = http.get(`${BASE_URL}/products`);

    check(res, {
      'products page - status is 200': (r) => r.status === 200,
      'products page - response time < 1s': (r) => r.timings.duration < 1000,
    });
  }

  sleep(2);
}
