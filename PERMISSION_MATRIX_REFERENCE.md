# RBAC Permission Matrix Reference

## Quick Overview

| Resource | ADMIN | MANAGER | SUPERVISOR | CASHIER | STOCK_CLERK |
|----------|:-----:|:-------:|:----------:|:-------:|:-----------:|
| Products | CRUD | R | R | R | R |
| Sales | CRUD* | R,RF,RET | R | C,R,VD,RF,RET | - |
| Inventory | CRUD* | R | R | R | CRUD* |
| Purchases | CRUD* | R | R | - | R |
| Reports | - | VE | V | - | - |
| Users | CRUD* | U,CP,RP | - | CP | CP |
| Roles | CRUD | R | - | - | - |
| Audit | V | V | V | - | - |

**Legend:**
- C = Create, R = Read, U = Update, D = Delete
- CRUD = All operations
- CRUD* = All operations (create, read, update, cancel/void variants)
- RF = Refund, RET = Return, CP = Change Password, RP = Reset Password
- VD = Void (transaction), V = View, VE = View & Export
- `-` = No access

---

## Detailed Permission Matrix

### ADMIN - Full System Access
```
products.create
products.read
products.update
products.delete

sales.create
sales.read
sales.update
sales.void
sales.refund
sales.return

inventory.read
inventory.update
inventory.adjust
inventory.transfer
inventory.recount

purchases.create
purchases.read
purchases.update
purchases.receive
purchases.cancel

reports.view
reports.export

users.create
users.read
users.update
users.delete
users.change-password
users.reset-password
users.unlock

roles.create
roles.read
roles.update
roles.delete

audit.view
```

### MANAGER - User & Report Management
```
products.read

sales.read
sales.refund
sales.return

inventory.read

purchases.read

reports.view
reports.export

users.read
users.update (non-admin only)
users.change-password
users.reset-password

roles.read

audit.view
```

### SUPERVISOR - Read-Only Reporting
```
products.read

sales.read

inventory.read

purchases.read

reports.view

users.read
users.change-password

audit.view
```

### CASHIER - Point of Sale Only
```
products.read

sales.create
sales.read
sales.void
sales.refund
sales.return

inventory.read

users.change-password
```

### STOCK_CLERK - Inventory Management
```
products.read

inventory.read
inventory.update
inventory.adjust
inventory.transfer
inventory.recount

purchases.read

users.change-password
```

---

## Resource Breakdown

### PRODUCTS (Catalog Management)
- `products.create` - Create new product
- `products.read` - View product details
- `products.update` - Edit product info
- `products.delete` - Remove/deactivate product

### SALES (Transactions)
- `sales.create` - Create new sale/transaction
- `sales.read` - View sales history and details
- `sales.update` - Modify sale prices/discounts
- `sales.void` - Void/cancel entire sale
- `sales.refund` - Issue refund to customer
- `sales.return` - Process item returns

### INVENTORY (Stock Management)
- `inventory.read` - View stock levels
- `inventory.update` - Update quantities
- `inventory.adjust` - Adjust for damage/loss/gain
- `inventory.transfer` - Move between warehouse locations
- `inventory.recount` - Perform physical count

### PURCHASES (Ordering)
- `purchases.create` - Create purchase order
- `purchases.read` - View purchase orders
- `purchases.update` - Edit pending orders
- `purchases.receive` - Mark purchase as received
- `purchases.cancel` - Cancel pending order

### REPORTS (Analytics)
- `reports.view` - Access reports page
- `reports.export` - Download reports as CSV/Excel

### USERS (Staff Management)
- `users.create` - Create new user account
- `users.read` - View user details and list
- `users.update` - Edit user info, role, department
- `users.delete` - Deactivate user account
- `users.change-password` - Change own password
- `users.reset-password` - Force password reset (admin)
- `users.unlock` - Unlock locked account (admin)

### ROLES (Role Management)
- `roles.create` - Create custom role
- `roles.read` - View role details and matrix
- `roles.update` - Modify role permissions
- `roles.delete` - Delete custom role

### AUDIT (Compliance)
- `audit.view` - View activity logs and audit trail

---

## Role-Based Access to Pages

### Frontend Routes

| Route | Pages | ADMIN | MANAGER | SUPERVISOR | CASHIER | STOCK_CLERK |
|-------|-------|:-----:|:-------:|:----------:|:-------:|:-----------:|
| /checkout | POSCheckout | ✓ | ✓ | - | ✓ | - |
| /products | ProductManagement | ✓ | ✓ | - | ✓ | ✓ |
| /dashboard | Dashboard | ✓ | ✓ | ✓ | - | - |
| /users | UserManagement | ✓ | ✓ | - | - | - |
| /roles | RoleManagement | ✓ | - | - | - | - |
| /activity | ActivityLog | ✓ | ✓ | - | - | - |

---

## Menu Item Visibility

### Admin Menu
- Checkout
- Products  
- Dashboard
- Users
- Roles
- Activity Log

### Manager Menu
- Checkout
- Products
- Dashboard
- Users
- Activity Log

### Supervisor Menu
- Dashboard

### Cashier Menu
- Checkout
- Products

### Stock Clerk Menu
- Products

---

## API Endpoint Access

### Public Endpoints (No Auth)
```
POST /api/auth/register - User registration
POST /api/auth/login - User login
```

### User Endpoints (Requires ADMIN or MANAGER)
```
GET  /api/users
GET  /api/users/:id (self or admin/manager)
POST /api/users (ADMIN only)
PUT  /api/users/:id (ADMIN only)
DELETE /api/users/:id (ADMIN only)
```

### Sensitive Endpoints (ADMIN Only)
```
POST /api/users/:id/reset-password
POST /api/users/:id/unlock
PUT /api/users/:id/roles
POST /api/roles
PUT /api/roles/:id
DELETE /api/roles/:id
```

### Self-Service Endpoints (All Authenticated Users)
```
POST /api/users/:id/change-password (own account only)
GET /api/auth/me (current user info)
POST /api/auth/refresh (token refresh)
```

---

## Permission Denial Scenarios

When a user lacks permission, they receive:

### HTTP 403 Forbidden
```json
{
  "error": "forbidden"
}
```

### Logged in PermissionLog
```
{
  "userId": "user123",
  "action": "DENY",
  "resource": "users",
  "permission": "users.create",
  "granted": false,
  "ipAddress": "192.168.1.1",
  "timestamp": "2026-03-03T10:30:00Z"
}
```

---

## Role Assignment Rules

### Built-in Roles (Cannot be deleted)
- ADMIN - System administrator (all access)
- MANAGER - Store manager (operational)
- SUPERVISOR - Supervisor (reporting only)
- CASHIER - Checkout operator (POS only)
- STOCK_CLERK - Inventory staff (stock only)

### Custom Roles (Can be created by ADMIN)
- Created via API POST /api/roles
- Up to 100 custom permissions per role
- Can be assigned to multiple users
- Cannot have same permissions as built-in roles automatically (must be configured)

### Assigning Roles
```
User -> Primary Role (enum: ADMIN, MANAGER, etc.)
User -> Custom Roles (via UserRole junction table, many-to-many)
```

---

## Security Best Practices

1. **Principle of Least Privilege**
   - Users given minimum permissions needed
   - Default to CASHIER or STOCK_CLERK
   - Promote to MANAGER/ADMIN only when necessary

2. **Audit Everything**
   - All permission denials logged
   - All sensitive actions logged
   - Regular audit log review

3. **Account Management**
   - Lock accounts after 5 failed logins
   - Require strong passwords
   - Force password change on first login
   - Admin can reset passwords

4. **Access Control**
   - All endpoints require authentication
   - All sensitive endpoints require specific roles
   - Frontend hides unauthorized menu items
   - Frontend route guards prevent direct access

---

Last Updated: March 3, 2026
