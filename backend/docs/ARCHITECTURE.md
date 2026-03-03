# Aether POS - Architecture Documentation

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend (React)                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │   Auth     │  │   Sales    │  │ Inventory  │  │  Reports     │  │
│  │ Components │  │ Components │  │ Components │  │  Components  │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────────┘  │
│         │                │               │              │           │
│         └────────────────┴───────────────┴──────────────┘           │
│                          │                                            │
│                  Fastify HTTP Client                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API Gateway & Security                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Rate Limiting (100 req/min default, 5 req/15min for login) │   │
│  │ CORS Security Policy                                         │   │
│  │ Helmet Security Headers                                      │   │
│  │ CSRF Protection                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Authentication Layer                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  JWT Token Mgmt  │  │  Brute Force Prot│  │  Password Hash   │  │
│  │ (AccessToken)    │  │  (Redis-based)   │  │  (bcrypt)        │  │
│  │  (RefreshToken)  │  │                  │  │                  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Route Handlers                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  Auth Routes │  │ Product      │  │  Sales Routes │               │
│  │  - register  │  │  Routes      │  │  - create    │               │
│  │  - login     │  │  - list      │  │  - refund    │               │
│  │  - refresh   │  │  - get       │  │  - return    │               │
│  │  - logout    │  │  - create    │  │  - void      │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Inventory    │  │  Users Routes│  │ Reports      │               │
│  │ Routes       │  │  - list      │  │ Routes       │               │
│  │  - list      │  │  - create    │  │  - sales     │               │
│  │  - adjust    │  │  - update    │  │  - inventory │               │
│  │  - transfer  │  │  - delete    │  │  - tax       │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐    │
│  │  Discount Engine │  │ Payment Engine   │  │ Inventory Mgmt │    │
│  │  - Calculate %   │  │ - Stripe adapter │  │ - Stock adjust │    │
│  │  - Calculate $ $ │  │ - Square adapter │  │ - Transfers    │    │
│  │  - Apply bulk    │  │ - PayPal adapter │  │ - Recount      │    │
│  │  - Apply loyalty │  │ - Encryption     │  │ - Audit log    │    │
│  └──────────────────┘  └──────────────────┘  └────────────────┘    │
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐    │
│  │  RBAC System     │  │ Audit Logging    │  │ Sync Engine    │    │
│  │  - Permissions   │  │ - Auth events    │  │ - Batch ops    │    │
│  │  - Role checking │  │ - Action logs    │  │ - Offline merge│    │
│  │  - Resource ACL  │  │ - Security log   │  │ - Conflict res │    │
│  └──────────────────┘  └──────────────────┘  └────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Database Layer                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │           PostgreSQL (Prisma ORM)                            │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐               │   │
│  │  │   User     │ │  Product   │ │   Sale     │               │   │
│  │  │  Role      │ │ Inventory  │ │  SaleItem  │               │   │
│  │  │ CustomRole │ │ Warehouse  │ │ Discount   │               │   │
│  │  └────────────┘ └────────────┘ └────────────┘               │   │
│  │                                                               │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐               │   │
│  │  │   Payment  │ │ AuditLog   │ │  Permission│               │   │
│  │  │ Processor  │ │ Customer   │ │   Log      │               │   │
│  │  │ Refund     │ │ Return Log │ │            │               │   │
│  │  └────────────┘ └────────────┘ └────────────┘               │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Cache Layer (Redis)                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │  Tokens Cache  │  │ Reports Cache  │  │  Brute Force   │        │
│  │  - Revoked     │  │ - Sales Sum    │  │  Counter       │        │
│  │  - Refresh     │  │ - Product Sales│  │                │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  External Services                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Stripe     │  │   Square     │  │   PayPal     │               │
│  │   Payment    │  │   Payment    │  │   Payment    │               │
│  │   Gateway    │  │   Gateway    │  │   Gateway    │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema

### User Management

```
┌──────────────────────┐
│        User          │
├──────────────────────┤
│ id (CUID)            │
│ email (UNIQUE)       │
│ password (HASHED)    │
│ firstName            │
│ lastName             │
│ phone                │
│ department           │
│ role (ENUM)          │
│ isActive             │
│ lastLogin            │
│ failedLoginAttempts  │
│ lockedAt             │
│ createdAt            │
│ updatedAt            │
└──────────────────────┘
        │ 1:N
        ├────────────────────┐
        │                    │
        ▼                    ▼
  ┌──────────────┐    ┌────────────────┐
  │RefreshToken  │    │  UserRole      │
  ├──────────────┤    ├────────────────┤
  │ id           │    │ id             │
  │ userId (FK)  │    │ userId (FK)    │
  │ token        │    │ customRoleId   │
  │ isRevoked    │    │ (FK)           │
  │ expiresAt    │    │ createdAt      │
  │ createdAt    │    └────────────────┘
  └──────────────┘              │
                                │ 1:N
                                ▼
                        ┌──────────────────┐
                        │   CustomRole     │
                        ├──────────────────┤
                        │ id               │
                        │ name (UNIQUE)    │
                        │ description      │
                        │ permissions (JSON)
                        │ isActive         │
                        │ createdAt        │
                        └──────────────────┘
```

### Product & Inventory

```
┌──────────────────┐
│    Product       │
├──────────────────┤
│ id (CUID)        │
│ sku (UNIQUE)     │
│ barcode (UNIQUE) │
│ name             │
│ description      │
│ category         │
│ priceCents       │
│ costCents        │
│ profitMarginCents│
│ imageUrl         │
│ isActive         │
│ createdAt        │
│ updatedAt        │
└──────────────────┘
        │ 1:N
        ├────────────────────┐
        │                    │
        ▼                    ▼
  ┌────────────────────┐  ┌──────────────────┐
  │InventoryLocation   │  │InventoryTransaction
  ├────────────────────┤  ├──────────────────┤
  │ id                 │  │ id               │
  │ productId (FK)     │  │ productId (FK)   │
  │ warehouseId (FK)   │  │ warehouseId (FK) │
  │ qty                │  │ qtyBefore        │
  │ minThreshold       │  │ qtyDelta         │
  │ maxThreshold       │  │ qtyAfter         │
  │ reorderPoint       │  │ type (ENUM)      │
  │ lastCounted        │  │ reason           │
  │ createdAt          │  │ notes            │
  └────────────────────┘  │ createdBy (FK)   │
                          │ createdAt        │
                          └──────────────────┘
        │ 1:N
        ▼
  ┌───────────────┐
  │  Warehouse    │
  ├───────────────┤
  │ id            │
  │ name          │
  │ location      │
  │ address       │
  │ isActive      │
  │ createdAt     │
  └───────────────┘
```

### Sales & Transactions

```
┌──────────────────────────┐
│        Sale              │
├──────────────────────────┤
│ id (CUID)                │
│ userId (FK) -> User      │
│ customerId (FK)          │
│ saleNumber (UNIQUE)      │
│ subtotalCents            │
│ discountCents            │
│ taxCents                 │
│ totalCents               │
│ paymentMethod (ENUM)     │
│ status (ENUM)            │
│ meta (JSON)              │
│ createdAt                │
│ updatedAt                │
└──────────────────────────┘
        │ 1:N
        ├────────────────────┐
        │                    │
        ▼                    ▼
  ┌──────────────────┐  ┌─────────────────┐
  │   SaleItem       │  │ Discount        │
  ├──────────────────┤  ├─────────────────┤
  │ id               │  │ id              │
  │ saleId (FK)      │  │ saleId (FK)     │
  │ productId (FK)   │  │ reason (ENUM)   │
  │ qty              │  │ type (%)/$)     │
  │ unitPrice        │  │ value           │
  │ discountCents    │  │ appliedAmount   │
  │ taxCents         │  │ createdAt       │
  └──────────────────┘  └─────────────────┘

        │ 1:1
        ▼
  ┌──────────────────┐
  │  Payment         │
  ├──────────────────┤
  │ id               │
  │ saleId (FK)      │
  │ processor        │
  │ amount           │
  │ status           │
  │ transactionId    │
  │ cardLastFour     │
  │ createdAt        │
  └──────────────────┘

        │ 1:N
        ▼
  ┌──────────────────┐
  │  Refund          │
  ├──────────────────┤
  │ id               │
  │ paymentId (FK)   │
  │ amount           │
  │ reason           │
  │ status           │
  │ refundTransId    │
  │ createdAt        │
  └──────────────────┘
```

### Audit & Logs

```
┌──────────────────────────┐
│      AuditLog            │
├──────────────────────────┤
│ id (CUID)                │
│ userId (FK)              │
│ action (ENUM)            │
│ resource (ENUM)          │
│ resourceId               │
│ oldValues (JSON)         │
│ newValues (JSON)         │
│ ipAddress                │
│ userAgent                │
│ details                  │
│ createdAt                │
└──────────────────────────┘

┌──────────────────────────┐
│    PermissionLog         │
├──────────────────────────┤
│ id                       │
│ userId (FK)              │
│ action (GRANT/DENY)      │
│ resource                 │
│ permission               │
│ granted (BOOL)           │
│ ipAddress                │
│ details                  │
│ timestamp                │
└──────────────────────────┘
```

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Client Initiates Login                                   │
│    POST /auth/login                                          │
│    { email, password }                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Server Validates Email & Bounds Check                    │
│    ├─ Check email format                                    │
│    ├─ Look up user in database                              │
│    └─ Check account lock status (failed attempts)           │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
        ┌──────────────────┐   ┌──────────────────┐
        │ User Not Found   │   │  Account Locked  │
        │ or Account       │   │  (5+ attempts)   │
        │ Locked           │   │  Locked 15 min   │
        │ (429 Error)      │   │  (429 Error)     │
        └──────────────────┘   └──────────────────┘
                              
                    (valid user)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Compare Password Hash                                     │
│    bcrypt.compare(password, db_hash)                         │
│    ├─ Match: Continue                                        │
│    └─ No Match: Increment failed attempts                    │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
        ┌──────────────────┐   ┌──────────────────┐
        │ Wrong Password   │   │ Password Match   │
        │ Increment count  │   │ Clear failures   │
        │ Return 401       │   │ Continue         │
        └──────────────────┘   └──────────────────┘
                              
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Generate Token Pair                                       │
│    ├─ Access Token: 15 min expiry                            │
│    │  - User ID, role, permissions                          │
│    │  - Signed with JWT_ACCESS_SECRET                        │
│    │                                                          │
│    └─ Refresh Token: 7 days expiry                           │
│       - Used to get new access token                         │
│       - Stored (hashed) in database                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Return Tokens to Client                                  │
│    {                                                          │
│      user: { id, email, role, ... },                         │
│      accessToken: "eyJhbGc...",                              │
│      refreshToken: "eyJhbGc...",                             │
│      expiresIn: 900                                          │
│    }                                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Client Stores Tokens                                     │
│    localStorage.setItem('accessToken', token)               │
│    localStorage.setItem('refreshToken', token)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Subsequent Requests Include Access Token                 │
│    Authorization: Bearer ACCESS_TOKEN                        │
│    GET /api/protected/resource                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Token Validation on Each Request                         │
│    ├─ Check JWT signature                                   │
│    ├─ Check expiration time                                 │
│    ├─ Check revocation status (Redis)                       │
│    └─ Verify user still exists & active                     │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
        ┌──────────────────┐   ┌──────────────────┐
        │ Token Valid      │   │ Token Invalid    │
        │ Allow Request    │   │ Return 401       │
        │                  │   │ Client refreshes │
        │                  │   │ with refresh     │
        │                  │   │ token            │
        └──────────────────┘   └──────────────────┘
                              
        (when token expires)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Client Refreshes Access Token                            │
│    POST /auth/refresh                                        │
│    { refreshToken: "eyJhbGc..." }                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. Server Validates Refresh Token                          │
│     ├─ Check JWT signature                                  │
│     ├─ Check expiration                                     │
│     ├─ Check revocation status                              │
│     ├─ Verify database hash matches                         │
│     └─ Check user still active                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. Issue New Token Pair                                    │
│     New AccessToken + New RefreshToken                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 12. Client Updates Tokens & Retries Request                │
└─────────────────────────────────────────────────────────────┘
```

## Sales Transaction Flow

```
CLIENT REQUEST
│
├─ POST /sales
│  {
│    items: [{ productId, qty, unitPrice }],
│    customerId?: string,
│    discounts?: [...],
│    taxRate: number,
│    paymentMethod: string
│  }
│
▼ VALIDATION
├─ Authenticate user
├─ Verify CASHIER role
├─ Validate product IDs exist
├─ Check all products have stock
│
▼ STOCK RESERVATION
├─ START TRANSACTION
│  ├─ Reserve stock for each item
│  └─ Check warehouse availability
│
▼ CALCULATE TOTALS
├─ Sum item subtotal (qty × unitPrice)
├─ GET CUSTOMER PROFILE (if provided)
│  ├─ Apply segment discount (loyalty)
│  └─ Check customer segment tier
├─ CALCULATE DISCOUNTS
│  ├─ Validate discount total < 50%
│  ├─ Apply manual discounts
│  ├─ Apply bulk discount (if applicable)
│  └─ Distribute discounts to items
├─ CALCULATE TAX
│  ├─ Tax = (subtotal - discounts) × taxRate
│  └─ Round to nearest cent
├─ CALCULATE FINAL TOTAL
│  └─ Total = Subtotal - Discounts + Tax
│
▼ CREATE SALE RECORD
├─ INSERT Sale {
│    userId, customerId,
│    subtotalCents, discountCents,
│    taxCents, totalCents,
│    paymentMethod, status: 'completed'
│  }
├─ INSERT SaleItems (one per product)
├─ INSERT Discount records
│
▼ UPDATE INVENTORY
├─ FOR EACH ITEM:
│  ├─ UPDATE InventoryLocation (decrease qty)
│  └─ INSERT InventoryTransaction (SOLD)
│
▼ LOG AUDIT
├─ Record sale creation in AuditLog
├─ Log inventory changes
│
▼ COMMIT TRANSACTION
├─ All or nothing (atomic)
│
▼ WEBHOOK EVENT
├─ Fire sale.completed webhook
│  └─ Payload with all sale details
│
▼ RETURN RESPONSE
└─ Return complete Sale object
   with items, discounts, totals


PAYMENT PROCESSING
│
├─ POST /payments/process
│  {
│    saleId, amount,
│    processor: 'STRIPE' | 'SQUARE' | 'PAYPAL',
│    cardToken
│  }
│
▼ LOOKUP SALE
├─ Find sale by ID
├─ Verify amount matches sale total
│
▼ VALIDATE
├─ Verify payment processor configured
├─ Check payment not already processed
│
▼ PROCESS WITH EXTERNAL GATEWAY
├─ STRIPE:
│  ├─ Call stripe.charges.create()
│  └─ ID: ch_xxxxx
├─ SQUARE:
│  ├─ Call square.payments.createPayment()
│  └─ ID: pay_xxxxx
└─ PAYPAL:
   ├─ Call paypal.createOrder()
   └─ ID: EC-xxxxx
│
▼ HANDLE RESPONSE
├─ Success (2xx):
│  ├─ INSERT Payment record (status: succeeded)
│  ├─ UPDATE Sale (status: paid)
│  ├─ Fire payment.processed webhook
│  └─ Return transaction ID
│
└─ Failure (4xx/5xx):
   ├─ INSERT Payment record (status: failed)
   ├─ Fire payment.failed webhook
   └─ Return error with reason


REFUND PROCESSING
│
├─ POST /sales/{saleId}/refund
│
▼ VALIDATE
├─ Find sale
├─ Check sale status is 'completed'
├─ Check not already refunded
├─ Verify MANAGER role
│
▼ PROCESS REFUND
├─ Get payment record
├─ Call payment processor refund API
│  ├─ STRIPE: stripe.refunds.create()
│  ├─ SQUARE: square.refunds.createRefund()
│  └─ PAYPAL: paypal.refundCapture()
│
▼ UPDATE RECORD
├─ INSERT Refund record
├─ UPDATE Sale (status: refunded)
├─ RESTORE INVENTORY
│  ├─ FOR EACH ITEM:
│  │  ├─ UPDATE InventoryLocation (increase qty)
│  │  └─ INSERT InventoryTransaction (RETURN)
│  
├─ LOG AUDIT
│  └─ Record refund in AuditLog
│
▼ WEBHOOK EVENT
├─ Fire sale.refunded webhook
├─ Fire payment.refunded webhook
│
└─ Return refund confirmation


ITEM RETURN
│
├─ POST /sales/{saleId}/return
│  {
│    items: [{ productId, qty }],
│    reason: string
│  }
│
▼ VALIDATE
├─ Verify sale exists & completed
├─ Verify items were in original sale
├─ Check quantities valid
│
▼ PARTIAL REFUND
├─ Calculate return amount
│  ├─ Sum returned items by unitPrice
│  └─ Deduct proportional discount
│
▼ UPDATE INVENTORY
├─ FOR EACH RETURNED ITEM:
│  ├─ UPDATE InventoryLocation (increase)
│  └─ INSERT InventoryTransaction (RETURN)
│
▼ CREATE RETURN RECORD
├─ INSERT Return {
│    saleId, items, amount, reason
│  }
│
├─ UPDATE Sale (if fully returned)
│
▼ LOG AUDIT
├─ Record return in AuditLog
│
▼ WEBHOOK EVENT
├─ Fire item.returned webhook
│
└─ Return updated sale
```

## Inventory Management Flow

```
STOCK ADJUSTMENT (Add or Remove)
│
├─ POST /inventory/adjust
│  {
│    productId, warehouseId,
│    qtyDelta: ±50,  // + to add, - to remove
│    reason: ENUM,
│    notes?: string
│  }
│
▼ VALIDATION
├─ Verify product exists
├─ Verify warehouse exists
├─ Verify STOCK_CLERK role
│
▼ CHECK CONSTRAINTS
├─ IF qtyDelta < 0:
│  └─ Ensure result won't be negative
│
▼ ATOMIC UPDATE
├─ START TRANSACTION
│  ├─ GET current qty (with lock)
│  ├─ Verify: (current + delta) >= 0
│  ├─ UPDATE InventoryLocation
│  │  └─ qty = qty + qtyDelta
│  ├─ INSERT InventoryTransaction
│  │  ├─ qtyBefore: current
│  │  ├─ qtyDelta: delta
│  │  ├─ qtyAfter: current + delta
│  │  ├─ type: ADJUSTMENT
│  │  ├─ reason: provided reason
│  │  ├─ createdBy: user ID
│  │
│  ├─ CHECK THRESHOLDS
│  │  ├─ IF qtyAfter < minThreshold:
│  │  │  └─ Fire inventory.low_stock webhook
│  │  └─ IF qtyAfter > maxThreshold:
│  │     └─ Log warning
│  │
│  └─ COMMIT
│
▼ AUDIT LOG
├─ Record adjustment in AuditLog
│
▼ RETURN
└─ Return updated InventoryLocation


WAREHOUSE TRANSFER
│
├─ POST /inventory/transfer
│  {
│    productId,
│    fromWarehouseId,
│    toWarehouseId,
│    qty: 25,
│    notes?: string
│  }
│
▼ VALIDATION
├─ Verify all IDs valid
├─ Verify STOCK_CLERK role
│
▼ ATOMIC UPDATE
├─ START TRANSACTION
│  ├─ GET from location qty (lock)
│  ├─ Verify: qty >= transferQty
│  │
│  ├─ UPDATE FROM location
│  │  ├─ qty -= transferQty
│  │  └─ INSERT transaction (TRANSFER out)
│  │
│  ├─ UPDATE TO location
│  │  ├─ qty += transferQty
│  │  └─ INSERT transaction (TRANSFER in)
│  │
│  └─ COMMIT
│
▼ WEBHOOKS
├─ Fire inventory.transferred webhook
│
└─ Return both locations


INVENTORY RECOUNT (Physical Count)
│
├─ POST /inventory/recount
│  {
│    warehouseId,
│    items: [{ productId, countedQty }],
│    countDate: Date
│  }
│
▼ VALIDATION
├─ Verify warehouse & products exist
├─ Verify STOCK_CLERK role
│
▼ PROCESS EACH ITEM
├─ FOR EACH counted item:
│  ├─ GET current system qty
│  ├─ Calculate variance
│  │  └─ variance = countedQty - systemQty
│  │
│  ├─ IF variance ≠ 0:
│  │  ├─ CREATE adjustment transaction
│  │  │  ├─ qtyDelta = variance
│  │  │  └─ type: RECOUNT
│  │  │
│  │  └─ UPDATE InventoryLocation
│  │     └─ qty = countedQty
│  │        lastCounted = now()
│  │
│  └─ UPDATE InventoryLocation
│     └─ qty = countedQty
│        lastCounted = now()
│
▼ COLLECT VARIANCE REPORT
├─ Summarize all discrepancies
│  └─ Save in response
│
▼ AUDIT & WEBHOOKS
├─ Log recount event
├─ Fire inventory.counted webhook
│  └─ Include variance details
│
├─ Log permission access
│
└─ Return recount report


LOW STOCK ALERT
│
(Triggered when qty falls below reorderPoint during:
 - Sale creation, - Stock adjustment, - Recount)
│
├─ CHECK: qty < reorderPoint
│
└─ IF TRUE:
   ├─ Fire inventory.low_stock webhook
   ├─ Log alert event
   └─ Admin can see in dashboard
```

## Data Flow for Complex Operations

### Complete Sale Flow

```
┌─────────────────────────────────────────┐
│ 1. Customer Scans Items (Frontend)      │
│    • Add to cart array                  │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 2. Display Subtotal & Apply Discount    │
│    • Show subtotal                      │
│    • Apply coupon code                  │
│    • Show loyalty discount              │
│    • Display tax estimation             │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 3. Create Sale (POST /sales)            │
│    Backend Queries:                     │
│    • SELECT from Product (pricing)      │
│    • SELECT from InventoryLocation      │
│    • SELECT from Customer (discount)    │
│    • INSERT into Sale                   │
│    • INSERT into SaleItem (multiple)    │
│    • INSERT into Discount (multiple)    │
│    • UPDATE InventoryLocation (qty--)   │
│    • INSERT InventoryTransaction        │
│    • COMMIT (atomic)                    │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 4. Display Sale Summary                 │
│    Frontend Shows:                      │
│    • Sale number                        │
│    • Items with prices                  │
│    • Discounts applied                  │
│    • Tax                                │
│    • Total (in currency)                │
│    • Payment method options             │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 5. Process Payment (POST /payments)     │
│    Backend:                             │
│    • Validate sale exists & not paid    │
│    • Call 3rd party processor           │
│    • On success:                        │
│      INSERT Payment (succeeded)         │
│      UPDATE Sale (status=paid)          │
│      Fire webhook                       │
│    • Fire receipt print event           │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 6. Print Receipt (Frontend)             │
│    • Format sale details                │
│    • Include all items                  │
│    • Show payment method                │
│    • Add company info & return policy   │
└─────────────────────────────────────────┘
                   │
                   └─ Complete!
```

## Sync Engine Flow (Offline Support)

```
CLIENT (offline)
│
├─ Queue operations locally:
│  ├─ Create sale ──► localStorage
│  ├─ Adjust inventory ──► localStorage
│  └─ Return items ──► localStorage
│
│ (No network requests)
│
▼ When Connection Returns
│
├─ SYNC QUEUE
│  ├─ GET all queued operations
│  ├─ Sort by timestamp
│  ├─ Remove duplicates
│
▼ POST /sync/batch
│  {
│    operations: [
│      {
│        id: 'op_123',
│        type: 'CREATE_SALE',
│        timestamp: date,
│        data: {...}
│      },
│      ...
│    ]
│  }
│
▼ SERVER PROCESSING
├─ START TRANSACTION
│  ├─ FOR EACH operation:
│  │  ├─ Check idempotency (already processed?)
│  │  │  ├─ Use operation.id as key
│  │  │  ├─ Check SyncLog table
│  │  │  └─ If exists, skip
│  │  │
│  │  ├─ Process operation (same as normal)
│  │  ├─ INSERT SyncLog record
│  │  │  └─ Link to original operation
│  │  │
│  │  └─ HANDLE CONFLICTS:
│  │     ├─ Sale already exists: skip
│  │     ├─ Stock negative: reject
│  │     └─ Inventory conflict:
│  │        ├─ Use server state winner
│  │        └─ Log conflict
│  │
│  └─ COMMIT
│
▼ RESPONSE
├─ Return results for each operation
│  ├─ status: 'SUCCESS' | 'DUPLICATE' | 'ERROR'
│  ├─ result: processed record or error
│  └─ serverTimestamp: now()
│
▼ CLIENT UPDATE
├─ FOR each successful operation:
│  ├─ Remove from local queue
│  ├─ Update local record with server version
│  ├─ Update UI
│
└─ FOR each failed operation:
   ├─ User notification
   ├─ Manual review required
```

