# Aether POS API Reference Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Common Use Cases](#common-use-cases)
4. [Error Handling](#error-handling)
5. [Pagination & Filtering](#pagination--filtering)
6. [Best Practices](#best-practices)

## Getting Started

### Base URL

```
Development: http://localhost:4000
Production:  https://api.aetherpos.local
```

### Quick Test

Check API health:
```bash
curl http://localhost:4000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-04T10:30:00Z",
  "uptime": 1234.56
}
```

## Authentication

### Register New User

Create a new user account:

```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

**Requirements:**
- Email must be valid and unique
- Password must be 8+ characters with:
  - At least one uppercase letter
  - At least one lowercase letter  
  - At least one number
  - At least one special character (!@#$%^&*)

**Response (201 Created):**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "firstName": null,
  "lastName": null,
  "role": "CASHIER",
  "isActive": true,
  "createdAt": "2026-03-04T10:30:00Z",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 900
}
```

### Login

Authenticate and get tokens:

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

**Security Notes:**
- Login limited to 5 attempts per 15 minutes
- Account locks after 5 failed attempts
- Each failed attempt is logged
- SQL injection and XSS attempts blocked

**Response (200 OK):**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "role": "CASHIER",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 900
}
```

### Refresh Access Token

When access token expires (~15 min), refresh it:

```bash
curl -X POST http://localhost:4000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGc..."
  }'
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 900
}
```

### Using Tokens

Include token in Authorization header:

```bash
curl http://localhost:4000/products \
  -H "Authorization: Bearer eyJhbGc..."
```

All protected endpoints require this header.

### Logout

Revoke tokens and logout:

```bash
curl -X POST http://localhost:4000/auth/logout \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGc..."
  }'
```

### Change Password

Update your password:

```bash
curl -X POST http://localhost:4000/auth/change-password \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPassword123!",
    "newPassword": "NewPassword456!"
  }'
```

## Common Use Cases

### Use Case 1: Complete Purchase Workflow

#### 1. Create a Sale

```bash
curl -X POST http://localhost:4000/sales \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "prod_001",
        "qty": 2,
        "unitPrice": 9999
      },
      {
        "productId": "prod_002",
        "qty": 1,
        "unitPrice": 15000
      }
    ],
    "customerId": "cust_123",
    "discounts": [
      {
        "reason": "LOYALTY",
        "type": "PERCENTAGE",
        "value": 5
      }
    ],
    "taxRate": 8.5,
    "paymentMethod": "CARD"
  }'
```

**Response:**
```json
{
  "id": "sale_123",
  "saleNumber": "SL-20260304-001",
  "items": [
    {
      "productId": "prod_001",
      "qty": 2,
      "unitPrice": 9999,
      "subtotalCents": 19998,
      "discountCents": 1000
    },
    {
      "productId": "prod_002",
      "qty": 1,
      "unitPrice": 15000,
      "subtotalCents": 15000,
      "discountCents": 750
    }
  ],
  "subtotalCents": 34998,
  "discountCents": 1750,
  "taxCents": 2664,
  "totalCents": 35912,
  "status": "completed",
  "createdAt": "2026-03-04T10:30:00Z"
}
```

#### 2. Process Payment

```bash
curl -X POST http://localhost:4000/payments/process \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "saleId": "sale_123",
    "amount": 35912,
    "processor": "STRIPE",
    "cardToken": "tok_visa_4242"
  }'
```

#### 3. Print Receipt

All sale data is available for printing. Use the response from step 1.

### Use Case 2: Return Items from Sale

```bash
curl -X POST http://localhost:4000/sales/sale_123/return \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "prod_001",
        "qty": 1
      }
    ],
    "reason": "CUSTOMER_REQUEST"
  }'
```

### Use Case 3: Manage Inventory

#### List All Inventory

```bash
curl http://localhost:4000/inventory \
  -H "Authorization: Bearer TOKEN"
```

#### Get Product Inventory

```bash
curl http://localhost:4000/inventory/prod_001 \
  -H "Authorization: Bearer TOKEN"
```

#### Adjust Stock

```bash
curl -X POST http://localhost:4000/inventory/adjust \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "prod_001",
    "warehouseId": "wh_001",
    "qtyDelta": 50,
    "reason": "RESTOCK",
    "notes": "New shipment received"
  }'
```

For removal: use negative `qtyDelta` (-10 removes 10 units)

#### Transfer Between Warehouses

```bash
curl -X POST http://localhost:4000/inventory/transfer \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "prod_001",
    "fromWarehouseId": "wh_001",
    "toWarehouseId": "wh_002",
    "qty": 25,
    "notes": "Transfer for rebalancing"
  }'
```

#### Record Physical Count

```bash
curl -X POST http://localhost:4000/inventory/recount \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "warehouseId": "wh_001",
    "items": [
      {
        "productId": "prod_001",
        "countedQty": 50
      },
      {
        "productId": "prod_002",
        "countedQty": 100
      }
    ],
    "countDate": "2026-03-04"
  }'
```

### Use Case 4: Get Sales Reports

#### Daily Sales Summary

```bash
curl 'http://localhost:4000/reports/sales-summary?groupBy=day&dateFrom=2026-03-01&dateTo=2026-03-04' \
  -H "Authorization: Bearer TOKEN"
```

#### Sales by Product

```bash
curl 'http://localhost:4000/reports/sales-by-product?dateFrom=2026-02-01&dateTo=2026-03-04' \
  -H "Authorization: Bearer TOKEN"
```

### Use Case 5: Product Management

#### List Products

```bash
curl 'http://localhost:4000/products?skip=0&take=50&category=beverages&sortBy=price&sortOrder=asc' \
  -H "Authorization: Bearer TOKEN"
```

#### Create Product

```bash
curl -X POST http://localhost:4000/products \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "PROD-NEW-001",
    "name": "New Product",
    "description": "Product description",
    "category": "beverages",
    "priceCents": 29999,
    "costCents": 12000,
    "imageUrl": "https://cdn.example.com/product.jpg"
  }'
```

#### Update Product

```bash
curl -X PUT http://localhost:4000/products/prod_001 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "priceCents": 39999
  }'
```

#### Delete Product

```bash
curl -X DELETE http://localhost:4000/products/prod_001 \
  -H "Authorization: Bearer TOKEN"
```

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "additional context"
  },
  "timestamp": "2026-03-04T10:30:00Z"
}
```

### Common Errors and Solutions

| HTTP | Error | Cause | Solution |
|------|-------|-------|----------|
| 400 | INVALID_EMAIL | Email format invalid | Provide valid email |
| 400 | INVALID_PASSWORD | Password too weak | Use 8+ chars with mixed case |
| 409 | DUPLICATE_EMAIL | Email already exists | Try different email |
| 401 | WRONG_PASSWORD | Incorrect credentials | Verify password |
| 429 | ACCOUNT_LOCKED | Too many failed attempts | Wait 15 minutes or contact admin |
| 401 | INVALID_TOKEN | Token expired/invalid | Get new token via refresh |
| 400 | INSUFFICIENT_STOCK | Not enough inventory | Reduce qty or add stock |
| 409 | SKU_EXISTS | SKU already in system | Use different SKU |
| 403 | PERMISSION_DENIED | User role insufficient | Contact admin for permission |
| 404 | NOT_FOUND | Resource doesn't exist | Verify ID/SKU |

### Handling Specific Errors

**Expired Token:**
```javascript
if (response.status === 401 && response.data.code === 'INVALID_TOKEN') {
  // Refresh token and retry
  const { accessToken } = await refreshToken(refreshToken);
  // Retry original request with new token
}
```

**Out of Stock:**
```javascript
if (response.status === 400 && response.data.code === 'INSUFFICIENT_STOCK') {
  // Reduce quantity or notify customer
  const maxAvailable = response.data.details.available;
}
```

**Permission Denied:**
```javascript
if (response.status === 403 && response.data.code === 'PERMISSION_DENIED') {
  // Show permission error to user
  // Required role: response.data.details.requiredRole
}
```

## Pagination & Filtering

### Pagination

All list endpoints support offset-limit pagination:

```bash
# Get items 0-49
curl 'http://localhost:4000/products?skip=0&take=50'

# Get items 50-99
curl 'http://localhost:4000/products?skip=50&take=50'
```

Response includes total count:
```json
{
  "data": [...],
  "total": 1234,
  "skip": 0,
  "take": 50
}
```

**Calculate pages:**
```
totalPages = Math.ceil(total / take)
currentPage = skip / take + 1
```

### Filtering

#### Products
```bash
# By category
curl 'http://localhost:4000/products?category=beverages'

# Search by name/SKU/barcode
curl 'http://localhost:4000/products?search=coca'

# Only active products
curl 'http://localhost:4000/products?search=cola&active=true'
```

#### Sales
```bash
# By date range
curl 'http://localhost:4000/sales?dateFrom=2026-03-01&dateTo=2026-03-04'

# By status
curl 'http://localhost:4000/sales?status=completed'

# By customer
curl 'http://localhost:4000/sales?customerId=cust_123'
```

#### Users
```bash
# By role
curl 'http://localhost:4000/users?role=CASHIER'

# Active users only
curl 'http://localhost:4000/users?isActive=true'

# By department
curl 'http://localhost:4000/users?department=sales'
```

### Sorting

```bash
# Sort by name ascending
curl 'http://localhost:4000/products?sortBy=name&sortOrder=asc'

# Sort by price descending
curl 'http://localhost:4000/products?sortBy=price&sortOrder=desc'

# Sort by creation date
curl 'http://localhost:4000/products?sortBy=createdAt&sortOrder=desc'
```

## Best Practices

### 1. Token Management

```javascript
// Store tokens securely
localStorage.setItem('accessToken', response.accessToken);
localStorage.setItem('refreshToken', response.refreshToken);

// Implement token rotation
setInterval(async () => {
  const { accessToken } = await api.post('/auth/refresh', {
    refreshToken: localStorage.getItem('refreshToken')
  });
  localStorage.setItem('accessToken', accessToken);
}, 10 * 60 * 1000); // Refresh every 10 minutes
```

### 2. Error Retry Logic

```javascript
async function apiCall(url, options, retries = 3) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (retries > 0) {
      await sleep(1000 * (3 - retries)); // Exponential backoff
      return apiCall(url, options, retries - 1);
    }
    throw error;
  }
}
```

### 3. Handling Rate Limits

Check rate limit headers:
```javascript
const limit = response.headers.get('X-RateLimit-Limit');
const remaining = response.headers.get('X-RateLimit-Remaining');
const reset = response.headers.get('X-RateLimit-Reset');

if (remaining === '0') {
  const waitTime = new Date(reset * 1000) - new Date();
  console.warn(`Rate limited. Retry after ${waitTime}ms`);
}
```

### 4. Stock Availability Check

Before creating a sale:
```javascript
const product = await api.get(`/inventory/${productId}`);
if (product.totalQty < requestedQty) {
  throw new Error(`Only ${product.totalQty} available`);
}
```

### 5. Discount Validation

Discounts cannot exceed 50% of subtotal:
```javascript
const maxDiscount = subtotal * 0.5;
if (discountAmount > maxDiscount) {
  throw new Error(`Discount cannot exceed ${maxDiscount}`);
}
```

### 6. Idempotency

For critical operations (payments), use idempotency keys:
```bash
curl -X POST http://localhost:4000/payments/process \
  -H "Authorization: Bearer TOKEN" \
  -H "Idempotency-Key: sale_123_payment_1" \
  -d '...'
```

### 7. Pagination Best Practices

```javascript
// For large datasets, use smaller batches
const batchSize = 50;
let skip = 0;
let allProducts = [];

while (skip < total) {
  const response = await api.get(`/products?skip=${skip}&take=${batchSize}`);
  allProducts = allProducts.concat(response.data);
  skip += batchSize;
}
```

### 8. Offline Support

Cache critical data locally:
```javascript
const products = await api.get('/products');
localStorage.setItem('products_cache', JSON.stringify(products));

// Use cache if offline
if (!navigator.onLine) {
  const cached = JSON.parse(localStorage.getItem('products_cache'));
  return cached;
}
```

### 9. Logging and Monitoring

Log important events for debugging:
```javascript
api.interceptors.response.use(null, (error) => {
  console.log({
    timestamp: new Date(),
    endpoint: error.config.url,
    method: error.config.method,
    status: error.response?.status,
    error: error.response?.data?.code,
    userId: getCurrentUserId()
  });
  return Promise.reject(error);
});
```

### 10. Data Validation

Validate before sending:
```javascript
const validatedProduct = {
  ...product,
  priceCents: Math.floor(product.priceCents * 100),
  costCents: Math.floor(product.costCents * 100)
};
```

