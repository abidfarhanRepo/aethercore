# Webhook Documentation

Webhooks allow your system to receive real-time notifications about important events in Aether POS.

## Overview

Webhooks are HTTP POST requests sent to your application when specific events occur. This allows you to:
- Update your own database in real-time
- Trigger workflows and notifications
- Sync data between systems
- Generate reports and analytics

## Webhook Endpoints

Configure where webhooks should be sent:

```bash
curl -X POST http://localhost:4000/webhooks/subscribe \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourapp.com/webhooks/aether",
    "events": [
      "sale.completed",
      "payment.processed",
      "inventory.adjusted"
    ],
    "active": true,
    "retryPolicy": {
      "maxRetries": 5,
      "backoffMultiplier": 2
    }
  }'
```

## Events

### Sales Events

#### `sale.completed`
Fired when a sale is successfully completed.

**Payload:**
```json
{
  "event": "sale.completed",
  "timestamp": "2026-03-04T10:30:00Z",
  "id": "evt_123",
  "data": {
    "saleId": "sale_123",
    "saleNumber": "SL-20260304-001",
    "customerId": "cust_123",
    "userId": "user_456",
    "items": [
      {
        "productId": "prod_001",
        "qty": 2,
        "unitPrice": 9999,
        "subtotalCents": 19998,
        "discountCents": 1000
      }
    ],
    "subtotalCents": 34998,
    "discountCents": 1750,
    "taxCents": 2664,
    "totalCents": 35912,
    "paymentMethod": "CARD",
    "paymentProcessorTransactionId": "pi_1234567890",
    "createdAt": "2026-03-04T10:30:00Z"
  }
}
```

#### `sale.refunded`
Fired when a sale is fully refunded.

**Payload:**
```json
{
  "event": "sale.refunded",
  "timestamp": "2026-03-04T10:35:00Z",
  "id": "evt_124",
  "data": {
    "saleId": "sale_123",
    "refundAmount": 35912,
    "reason": "CUSTOMER_REQUEST",
    "refundedBy": "user_456",
    "refundTransactionId": "re_1234567890",
    "refundedAt": "2026-03-04T10:35:00Z"
  }
}
```

#### `sale.voided`
Fired when a sale is voided/cancelled.

**Payload:**
```json
{
  "event": "sale.voided",
  "timestamp": "2026-03-04T10:40:00Z",
  "id": "evt_125",
  "data": {
    "saleId": "sale_123",
    "reason": "DUPLICATE_ENTRY",
    "voidedBy": "user_456",
    "originalAmount": 35912,
    "voidedAt": "2026-03-04T10:40:00Z"
  }
}
```

#### `item.returned`
Fired when items are returned from a sale.

**Payload:**
```json
{
  "event": "item.returned",
  "timestamp": "2026-03-04T10:45:00Z",
  "id": "evt_126",
  "data": {
    "saleId": "sale_123",
    "items": [
      {
        "productId": "prod_001",
        "qty": 1,
        "unitPrice": 9999,
        "refundAmount": 9999
      }
    ],
    "totalReturnAmount": 9999,
    "reason": "CUSTOMER_REQUEST",
    "returnedAt": "2026-03-04T10:45:00Z"
  }
}
```

### Payment Events

#### `payment.processed`
Fired when a payment is successfully processed.

**Payload:**
```json
{
  "event": "payment.processed",
  "timestamp": "2026-03-04T10:31:00Z",
  "id": "evt_200",
  "data": {
    "paymentId": "pay_123",
    "saleId": "sale_123",
    "amount": 35912,
    "currency": "USD",
    "processor": "STRIPE",
    "processorTransactionId": "ch_1234567890",
    "paymentMethod": "card",
    "cardLastFour": "4242",
    "status": "succeeded",
    "processedAt": "2026-03-04T10:31:00Z"
  }
}
```

#### `payment.failed`
Fired when a payment fails.

**Payload:**
```json
{
  "event": "payment.failed",
  "timestamp": "2026-03-04T10:32:00Z",
  "id": "evt_201",
  "data": {
    "paymentId": "pay_123",
    "saleId": "sale_123",
    "amount": 35912,
    "processor": "STRIPE",
    "failureReason": "card_declined",
    "errorMessage": "Your card was declined",
    "failedAt": "2026-03-04T10:32:00Z"
  }
}
```

#### `payment.refunded`
Fired when a payment is refunded.

**Payload:**
```json
{
  "event": "payment.refunded",
  "timestamp": "2026-03-04T10:33:00Z",
  "id": "evt_202",
  "data": {
    "paymentId": "pay_123",
    "saleId": "sale_123",
    "originalAmount": 35912,
    "refundAmount": 35912,
    "processor": "STRIPE",
    "processorRefundId": "re_1234567890",
    "reason": "FULL_REFUND",
    "refundedAt": "2026-03-04T10:33:00Z"
  }
}
```

### Inventory Events

#### `inventory.adjusted`
Fired when inventory is adjusted.

**Payload:**
```json
{
  "event": "inventory.adjusted",
  "timestamp": "2026-03-04T11:00:00Z",
  "id": "evt_300",
  "data": {
    "productId": "prod_001",
    "warehouseId": "wh_001",
    "qtyBefore": 100,
    "qtyDelta": 50,
    "qtyAfter": 150,
    "reason": "RESTOCK",
    "notes": "New shipment received",
    "adjustedBy": "user_789",
    "adjustedAt": "2026-03-04T11:00:00Z"
  }
}
```

#### `inventory.transferred`
Fired when stock is transferred between warehouses.

**Payload:**
```json
{
  "event": "inventory.transferred",
  "timestamp": "2026-03-04T11:05:00Z",
  "id": "evt_301",
  "data": {
    "productId": "prod_001",
    "fromWarehouseId": "wh_001",
    "toWarehouseId": "wh_002",
    "qty": 25,
    "fromQtyBefore": 150,
    "fromQtyAfter": 125,
    "toQtyBefore": 50,
    "toQtyAfter": 75,
    "notes": "Rebalancing inventory",
    "transferredBy": "user_789",
    "transferredAt": "2026-03-04T11:05:00Z"
  }
}
```

#### `inventory.low_stock`
Fired when inventory falls below reorder point.

**Payload:**
```json
{
  "event": "inventory.low_stock",
  "timestamp": "2026-03-04T11:10:00Z",
  "id": "evt_302",
  "data": {
    "productId": "prod_001",
    "sku": "PROD-001",
    "productName": "Product Name",
    "warehouseId": "wh_001",
    "currentQty": 8,
    "reorderPoint": 10,
    "minThreshold": 5,
    "alertAt": "2026-03-04T11:10:00Z"
  }
}
```

#### `inventory.counted`
Fired when physical inventory recount is recorded.

**Payload:**
```json
{
  "event": "inventory.counted",
  "timestamp": "2026-03-04T11:15:00Z",
  "id": "evt_303",
  "data": {
    "warehouseId": "wh_001",
    "countDate": "2026-03-04",
    "itemsRecorded": 150,
    "variance": [
      {
        "productId": "prod_001",
        "sku": "PROD-001",
        "expectedQty": 100,
        "countedQty": 98,
        "discrepancy": -2
      }
    ],
    "discrepancyCount": 5,
    "countedBy": "user_789",
    "countedAt": "2026-03-04T11:15:00Z"
  }
}
```

### User Events

#### `user.created`
Fired when a new user is created.

**Payload:**
```json
{
  "event": "user.created",
  "timestamp": "2026-03-04T12:00:00Z",
  "id": "evt_400",
  "data": {
    "userId": "user_999",
    "email": "newuser@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "CASHIER",
    "department": "Sales",
    "createdBy": "user_123",
    "createdAt": "2026-03-04T12:00:00Z"
  }
}
```

#### `user.updated`
Fired when a user is updated.

**Payload:**
```json
{
  "event": "user.updated",
  "timestamp": "2026-03-04T12:05:00Z",
  "id": "evt_401",
  "data": {
    "userId": "user_999",
    "changes": {
      "role": {
        "before": "CASHIER",
        "after": "SUPERVISOR"
      },
      "isActive": {
        "before": true,
        "after": false
      }
    },
    "updatedBy": "user_123",
    "updatedAt": "2026-03-04T12:05:00Z"
  }
}
```

### System Events

#### `system.healthcheck`
Fired periodically to verify webhook endpoint is alive.

**Payload:**
```json
{
  "event": "system.healthcheck",
  "timestamp": "2026-03-04T12:30:00Z",
  "id": "evt_500"
}
```

**Expected Response:**
```json
{
  "status": "ok"
}
```

## Webhook Security

### Signature Verification

All webhooks include a signature for verification:

```
X-Aether-Signature: sha256=<signature>
X-Aether-Timestamp: <timestamp>
```

**Verify signature:**

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64');
  
  return hash === signature;
}

// In webhook handler
app.post('/webhooks/aether', (req, res) => {
  const signature = req.headers['x-aether-signature'];
  const timestamp = req.headers['x-aether-timestamp'];
  const payload = req.rawBody; // Must use raw body string
  
  // Check timestamp (prevent replay attacks)
  const now = Date.now();
  const webhookTime = parseInt(timestamp) * 1000;
  if (Math.abs(now - webhookTime) > 5 * 60 * 1000) {
    return res.status(401).send('Timestamp outside acceptable window');
  }
  
  if (!verifySignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  const event = JSON.parse(payload);
  handleWebhookEvent(event);
  
  res.json({ received: true });
});
```

### Best Practices

1. **Always verify signatures** - Don't trust unsigned webhooks
2. **Check timestamps** - Reject webhooks older than 5 minutes
3. **Use HTTPS** - Webhooks must be sent to HTTPS endpoints
4. **Idempotency** - Handle duplicate events gracefully
5. **Timeout handling** - Respond within 30 seconds

## Retry Policy

Webhooks use exponential backoff for retries:

| Attempt | Delay | Total Wait |
|---------|-------|-----------|
| 1 | - | - |
| 2 | 1 second | 1s |
| 3 | 2 seconds | 3s |
| 4 | 4 seconds | 7s |
| 5 | 8 seconds | 15s |

**Total time:** ~15-30 seconds per webhook

Failed webhooks are logged and can be manually retried via the admin dashboard.

## Response Expected

**Success (2xx)**
```bash
HTTP/1.1 200 OK
Content-Type: application/json

{ "received": true }
```

**Temporary Failure (5xx)**
Webhook will be retried after delay.

**Permanent Failure (4xx)**
Webhook will not be retried. Check logs.

## Event Webhooks Testing

Test your webhook endpoint:

```bash
curl -X POST https://yourapp.com/webhooks/aether \
  -H "Content-Type: application/json" \
  -H "X-Aether-Signature: sha256=test" \
  -H "X-Aether-Timestamp: $(date +%s)" \
  -d '{
    "event": "sale.completed",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "id": "test_evt_123",
    "data": {
      "saleId": "test_123",
      "totalCents": 35912
    }
  }'
```

## Webhook Management

### List Subscriptions

```bash
curl http://localhost:4000/webhooks \
  -H "Authorization: Bearer TOKEN"
```

### Update Subscription

```bash
curl -X PUT http://localhost:4000/webhooks/webhook_123 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://newurl.com/webhooks/aether",
    "events": ["sale.completed", "payment.processed"],
    "active": true
  }'
```

### Delete Subscription

```bash
curl -X DELETE http://localhost:4000/webhooks/webhook_123 \
  -H "Authorization: Bearer TOKEN"
```

### View Delivery Status

```bash
curl http://localhost:4000/webhooks/webhook_123/deliveries \
  -H "Authorization: Bearer TOKEN"
```

### Retry Failed Webhook

```bash
curl -X POST http://localhost:4000/webhooks/webhook_123/retry/evt_123 \
  -H "Authorization: Bearer TOKEN"
```

