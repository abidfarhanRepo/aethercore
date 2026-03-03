# Advanced Sales Features - Quick Reference Guide

## Backend API Usage Examples

### 1. Create a Basic Sale

```bash
curl -X POST http://localhost:4000/api/sales \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "prod_123",
        "qty": 2,
        "unitPrice": 1000
      }
    ],
    "paymentMethod": "CASH"
  }'
```

### 2. Create Sale with Discount

```bash
curl -X POST http://localhost:4000/api/sales \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "prod_123",
        "qty": 1,
        "unitPrice": 5000
      }
    ],
    "discounts": [
      {
        "reason": "COUPON",
        "type": "PERCENTAGE",
        "percentage": 10,
        "description": "Spring sale"
      }
    ],
    "paymentMethod": "CASH"
  }'
```

### 3. Create Sale with VIP Customer

```bash
curl -X POST http://localhost:4000/api/sales \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust_456",
    "items": [
      {
        "productId": "prod_123",
        "qty": 1,
        "unitPrice": 1000
      }
    ],
    "paymentMethod": "CASH"
  }'
```
*Note: VIP customers automatically get 10% discount*

### 4. Create Sale with Split Payment

```bash
curl -X POST http://localhost:4000/api/sales \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "prod_123",
        "qty": 2,
        "unitPrice": 2000
      }
    ],
    "payments": [
      {
        "method": "CARD",
        "amountCents": 2000,
        "reference": "4242"
      },
      {
        "method": "CASH",
        "amountCents": 2200
      }
    ],
    "paymentMethod": "SPLIT"
  }'
```

### 5. List Sales with Filters

```bash
# By payment method
curl 'http://localhost:4000/api/sales?paymentMethod=CASH'

# By date range
curl 'http://localhost:4000/api/sales?startDate=2026-03-01&endDate=2026-03-31'

# By status
curl 'http://localhost:4000/api/sales?status=completed'

# With pagination
curl 'http://localhost:4000/api/sales?limit=10&offset=20'

# Combined
curl 'http://localhost:4000/api/sales?paymentMethod=CASH&status=completed&limit=50&offset=0'
```

### 6. Get Sale Details

```bash
curl 'http://localhost:4000/api/sales/sale_abc123'
```

### 7. Process Full Refund

```bash
curl -X POST http://localhost:4000/api/sales/sale_abc123/refund \
  -H "Content-Type: application/json" \
  -d '{
    "type": "full",
    "reason": "CHANGE_MIND",
    "notes": "Customer changed mind"
  }'
```

### 8. Process Partial Refund

```bash
curl -X POST http://localhost:4000/api/sales/sale_abc123/refund \
  -H "Content-Type: application/json" \
  -d '{
    "type": "partial",
    "reason": "DEFECTIVE",
    "notes": "Product defective",
    "items": [
      {
        "itemId": "item_1",
        "qty": 1
      }
    ]
  }'
```

### 9. Void a Sale

```bash
curl -X POST http://localhost:4000/api/sales/sale_abc123/void \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Posted in error"
  }'
```

### 10. Get Sales Analytics

```bash
# Daily summary
curl 'http://localhost:4000/api/sales/analytics/summary?period=daily'

# Weekly summary
curl 'http://localhost:4000/api/sales/analytics/summary?period=weekly'

# Monthly summary for specific date range
curl 'http://localhost:4000/api/sales/analytics/summary?period=monthly&startDate=2026-01-01&endDate=2026-03-31'
```

---

## Frontend Component Usage

### Using DiscountModal

```tsx
import { DiscountModal } from '@/components/DiscountModal'

const [isOpen, setIsOpen] = useState(false)

<DiscountModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onApply={(discount) => {
    console.log('Applied discount:', discount)
    // discount contains:
    // - reason: string
    // - type: 'FIXED_AMOUNT' | 'PERCENTAGE'
    // - amountCents: number
    // - percentage?: number
  }}
  subtotal={5000} // in cents
  maxDiscount={2500} // 50% max discount
/>
```

### Using PaymentModal

```tsx
import { PaymentModal } from '@/components/PaymentModal'

const [isOpen, setIsOpen] = useState(false)

<PaymentModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onApply={(payments) => {
    console.log('Selected payments:', payments)
    // payments is array of:
    // - method: 'CASH' | 'CARD' | ...
    // - amountCents: number
    // - reference?: string
  }}
  totalCents={5500} // total amount due
/>
```

### Using RefundModal

```tsx
import { RefundModal } from '@/components/RefundModal'

const [isOpen, setIsOpen] = useState(false)
const [saleId, setSaleId] = useState<string>()

<RefundModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onRefund={(result) => {
    console.log('Refund processed:', result)
    // result contains refund details
  }}
  saleId={saleId}
/>
```

### Using ReceiptPreview

```tsx
import { ReceiptPreview } from '@/components/ReceiptPreview'

<ReceiptPreview
  isOpen={true}
  onClose={() => {}}
  items={[
    { id: '1', name: 'Product A', qty: 2, unitPrice: 1000 },
    { id: '2', name: 'Product B', qty: 1, unitPrice: 2000 }
  ]}
  discounts={[
    { reason: 'PROMOTIONAL', amountCents: 300 }
  ]}
  subtotalCents={5000}
  discountTotalCents={300}
  taxCents={470}
  totalCents={5170}
  payments={[
    { method: 'CASH', amountCents: 5170, changeCents: 830 }
  ]}
  saleId="sale_abc123"
  timestamp={new Date()}
  cashierName="John Doe"
/>
```

---

## Discount Types & Usage

### FIXED_AMOUNT
Apply a fixed dollar amount discount
```javascript
{
  reason: "COUPON",
  type: "FIXED_AMOUNT",
  amountCents: 500,  // $5.00 off
  description: "Spring coupon"
}
```

### PERCENTAGE
Apply a percentage discount
```javascript
{
  reason: "PROMOTIONAL",
  type: "PERCENTAGE",
  percentage: 15,  // 15% off
  description: "Easter sale"
}
```

### BULK (Automatic)
Triggered when qty >= threshold:
- 10+ items: 5% off
- 25+ items: 10% off
- 50+ items: 15% off

### LOYALTY (Automatic for segments)
- VIP: 10% off
- WHOLESALE: 15% off

### LOYALTY_POINTS
Redeem points for discount
```javascript
{
  reason: "LOYALTY",
  type: "FIXED_AMOUNT",
  amountCents: 1000  // $10 from points
}
```

### EMPLOYEE
Staff discount
```javascript
{
  reason: "EMPLOYEE",
  type: "PERCENTAGE",
  percentage: 20
}
```

---

## Payment Methods

| Method | Description | Reference | Use Case |
|--------|-------------|-----------|----------|
| CASH | Physical currency | None | Counter sales |
| CARD | Credit/debit card | Last 4 digits | Card present |
| CHECK | Physical check | Check number | Wholesale, B2B |
| GIFT_CARD | Store gift card | Card ID | Returns, gift cards |
| LOYALTY_POINTS | Loyalty program points | Member ID | Rewards program |
| STORE_CREDIT | Account credit | Customer ID | Returns, credits |

---

## Calculation Flow

```
SUBTOTAL = Sum of (qty × unit price for each item)
  ↓
APPLY DISCOUNTS:
  - Add segment discount (VIP, WHOLESALE)
  - Add bulk discount if applicable
  - Add manual discounts
  - Sum all discounts
  ↓
APPLY TAX (10%):
  TAX = (SUBTOTAL - TOTAL_DISCOUNTS) × 0.10
  ↓
TOTAL = SUBTOTAL - TOTAL_DISCOUNTS + TAX
  ↓
PAYMENT:
  - Validate payment methods
  - Calculate change (for CASH)
  - Create payment records
```

---

## Error Handling

### Common Errors

**400 Bad Request:** Invalid discount/payment
```json
{
  "error": "Discounts exceed 50% of subtotal"
}
```

**400 Bad Request:** Payment validation failed
```json
{
  "error": "Insufficient cash. Need at least $39.60"
}
```

**404 Not Found:** Sale doesn't exist
```json
{
  "error": "Sale not found"
}
```

**400 Bad Request:** Can't void already voided sale
```json
{
  "error": "Sale already voided"
}
```

---

## Testing Examples

### Run All Sales Tests
```bash
npm test -- sales.test.ts
```

### Run Specific Test Suite
```bash
npm test -- --testNamePattern="POST /sales - Create Sale"
```

### Run with Coverage
```bash
npm test -- --coverage sales.test.ts
```

---

## Database Queries

### Get all discounts given today
```prisma
const discounts = await prisma.saleDiscount.findMany({
  where: {
    sale: {
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    }
  },
  include: { sale: true }
})
```

### Get all VIP customer purchases
```prisma
const vpPurchases = await prisma.sale.findMany({
  where: {
    customer: {
      segment: 'VIP'
    }
  },
  include: { items: true, customer: true }
})
```

### Get refund statistics
```prisma
const refunds = await prisma.saleReturn.groupBy({
  by: ['reason'],
  _count: true,
  _sum: { refundAmountCents: true }
})
```

---

## Performance Tips

1. **Use pagination** when listing sales:
   - Default limit: 50
   - Max limit: 100

2. **Index frequently filtered fields:**
   - Sale.paymentMethod
   - Sale.status
   - Sale.createdAt

3. **Batch operations** when processing multiple returns

4. **Cache customer segments** for VIP discount checks

---

## Debugging Checklist

- [ ] Verify product IDs exist before sale creation
- [ ] Check discount percentage not exceeding 100%
- [ ] Ensure payment totals match sale total
- [ ] Verify customer exists for loyalty features
- [ ] Check warehouse inventory before sale
- [ ] Validate date ranges are correctly formatted
- [ ] Confirm payment method is supported
- [ ] Test refund with actual items from sale

---

## Useful Timestamps

Created: 2026-03-03
Updated: 2026-03-03
Status: Production Ready
