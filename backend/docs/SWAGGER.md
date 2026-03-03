# Aether POS API - OpenAPI 3.0 Specification

```yaml
openapi: 3.0.3
info:
  title: Aether POS Backend API
  description: |
    Comprehensive Point-of-Sale system API with offline support,
    advanced inventory management, RBAC, and reporting capabilities.
  version: 1.0.0
  contact:
    name: Aether Support
    email: support@aetherpos.local
  license:
    name: MIT

servers:
  - url: http://localhost:4000
    description: Development server
  - url: https://api.aetherpos.local
    description: Production server

tags:
  - name: Authentication
    description: User authentication and tokens
  - name: Products
    description: Product catalog management
  - name: Sales
    description: Sales transactions and refunds
  - name: Inventory
    description: Inventory management and tracking
  - name: Users
    description: User management
  - name: Reports
    description: Business reports and analytics
  - name: Payments
    description: Payment processing
  - name: Health
    description: System health check

paths:
  /health:
    get:
      tags:
        - Health
      summary: Health check endpoint
      description: Returns API health status and uptime
      operationId: healthCheck
      responses:
        '200':
          description: API is healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: ok
                  timestamp:
                    type: string
                    format: date-time
                  uptime:
                    type: number
                    example: 1234.56

  /auth/register:
    post:
      tags:
        - Authentication
      summary: Register new user
      operationId: registerUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - email
                - password
              properties:
                email:
                  type: string
                  format: email
                  example: user@example.com
                password:
                  type: string
                  minLength: 8
                  example: SecurePass123!
              description: Registration credentials (password must be 8+ chars with mixed case)
      responses:
        '201':
          description: User registered successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserWithTokens'
        '400':
          description: Invalid input or duplicate email
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '409':
          description: Email already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /auth/login:
    post:
      tags:
        - Authentication
      summary: Login user
      operationId: loginUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - email
                - password
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserWithTokens'
        '401':
          description: Invalid credentials or account locked
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '429':
          description: Too many failed attempts - account locked
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /auth/refresh:
    post:
      tags:
        - Authentication
      summary: Refresh access token
      operationId: refreshToken
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - refreshToken
              properties:
                refreshToken:
                  type: string
                  example: eyJhbGc...
      responses:
        '200':
          description: New token pair issued
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenPair'
        '401':
          description: Invalid or expired refresh token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /auth/logout:
    post:
      tags:
        - Authentication
      summary: Logout user and revoke tokens
      security:
        - BearerAuth: []
      operationId: logoutUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                refreshToken:
                  type: string
      responses:
        '200':
          description: Logout successful
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /auth/change-password:
    post:
      tags:
        - Authentication
      summary: Change user password
      security:
        - BearerAuth: []
      operationId: changePassword
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - currentPassword
                - newPassword
              properties:
                currentPassword:
                  type: string
                newPassword:
                  type: string
                  minLength: 8
      responses:
        '200':
          description: Password changed successfully
        '401':
          description: Unauthorized or wrong current password
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /products:
    get:
      tags:
        - Products
      summary: List all products
      operationId: listProducts
      parameters:
        - name: skip
          in: query
          schema:
            type: integer
            default: 0
        - name: take
          in: query
          schema:
            type: integer
            default: 50
        - name: search
          in: query
          schema:
            type: string
          description: Search by name, SKU, or barcode
        - name: category
          in: query
          schema:
            type: string
        - name: sortBy
          in: query
          schema:
            type: string
            enum: [name, price, sku, createdAt]
            default: name
        - name: sortOrder
          in: query
          schema:
            type: string
            enum: [asc, desc]
            default: asc
      responses:
        '200':
          description: List of products
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Product'
                  total:
                    type: integer
                  skip:
                    type: integer
                  take:
                    type: integer

    post:
      tags:
        - Products
      summary: Create new product
      security:
        - BearerAuth: []
      operationId: createProduct
      x-requires-role: MANAGER
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - sku
                - name
                - priceCents
              properties:
                sku:
                  type: string
                  example: PROD-001
                  description: Unique SKU (prevent duplicates)
                name:
                  type: string
                  example: Product Name
                description:
                  type: string
                category:
                  type: string
                priceCents:
                  type: integer
                  example: 9999
                  description: Price in cents
                costCents:
                  type: integer
                imageUrl:
                  type: string
                  format: uri
      responses:
        '201':
          description: Product created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
        '400':
          description: Invalid input or duplicate SKU
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '403':
          description: Insufficient permissions (requires MANAGER)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /products/{id}:
    get:
      tags:
        - Products
      summary: Get product details
      operationId: getProduct
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Product details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
        '404':
          description: Product not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    put:
      tags:
        - Products
      summary: Update product
      security:
        - BearerAuth: []
      operationId: updateProduct
      x-requires-role: MANAGER
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                description:
                  type: string
                category:
                  type: string
                priceCents:
                  type: integer
                costCents:
                  type: integer
                imageUrl:
                  type: string
      responses:
        '200':
          description: Product updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
        '404':
          description: Product not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    delete:
      tags:
        - Products
      summary: Delete product
      security:
        - BearerAuth: []
      operationId: deleteProduct
      x-requires-role: MANAGER
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Product deleted
        '404':
          description: Product not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /sales:
    post:
      tags:
        - Sales
      summary: Create new sale
      security:
        - BearerAuth: []
      operationId: createSale
      x-requires-role: CASHIER
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - items
              properties:
                items:
                  type: array
                  items:
                    type: object
                    required:
                      - productId
                      - qty
                      - unitPrice
                    properties:
                      productId:
                        type: string
                      qty:
                        type: integer
                        minimum: 1
                      unitPrice:
                        type: integer
                        description: Price in cents
                customerId:
                  type: string
                  description: Optional customer for loyalty discount
                discounts:
                  type: array
                  items:
                    type: object
                    properties:
                      reason:
                        type: string
                        enum: [LOYALTY, MANUAL, BULK, PROMO]
                      type:
                        type: string
                        enum: [PERCENTAGE, FIXED]
                      value:
                        type: number
                taxRate:
                  type: number
                  description: Tax rate percentage (0-100)
                paymentMethod:
                  type: string
                  enum: [CASH, CARD, CHECK, SPLIT]
      responses:
        '201':
          description: Sale created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Sale'
        '400':
          description: Invalid sale data (out of stock, invalid discount, etc)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '403':
          description: Insufficient permissions

    get:
      tags:
        - Sales
      summary: List sales with filters
      security:
        - BearerAuth: []
      operationId: listSales
      parameters:
        - name: dateFrom
          in: query
          schema:
            type: string
            format: date-time
        - name: dateTo
          in: query
          schema:
            type: string
            format: date-time
        - name: status
          in: query
          schema:
            type: string
            enum: [completed, voided, refunded]
        - name: skip
          in: query
          schema:
            type: integer
            default: 0
        - name: take
          in: query
          schema:
            type: integer
            default: 50
      responses:
        '200':
          description: List of sales
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Sale'
                  total:
                    type: integer

  /sales/{id}:
    get:
      tags:
        - Sales
      summary: Get sale details
      security:
        - BearerAuth: []
      operationId: getSale
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Sale details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Sale'
        '404':
          description: Sale not found

  /sales/{id}/refund:
    post:
      tags:
        - Sales
      summary: Refund entire sale
      security:
        - BearerAuth: []
      operationId: refundSale
      x-requires-role: MANAGER
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                reason:
                  type: string
                notes:
                  type: string
      responses:
        '200':
          description: Refund processed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Sale'
        '400':
          description: Sale cannot be refunded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /sales/{id}/return:
    post:
      tags:
        - Sales
      summary: Return specific items from sale
      security:
        - BearerAuth: []
      operationId: returnItems
      x-requires-role: CASHIER
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - items
              properties:
                items:
                  type: array
                  items:
                    type: object
                    required:
                      - productId
                      - qty
                    properties:
                      productId:
                        type: string
                      qty:
                        type: integer
                reason:
                  type: string
      responses:
        '200':
          description: Return processed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Sale'

  /sales/{id}/void:
    post:
      tags:
        - Sales
      summary: Void sale (cancel it)
      security:
        - BearerAuth: []
      operationId: voidSale
      x-requires-role: MANAGER
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                reason:
                  type: string
      responses:
        '200':
          description: Sale voided
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Sale'

  /inventory:
    get:
      tags:
        - Inventory
      summary: Get all inventory locations with stock levels
      security:
        - BearerAuth: []
      operationId: listInventory
      parameters:
        - name: warehouseId
          in: query
          schema:
            type: string
        - name: productId
          in: query
          schema:
            type: string
        - name: lowStockOnly
          in: query
          schema:
            type: boolean
      responses:
        '200':
          description: Inventory data
          content:
            application/json:
              schema:
                type: object
                properties:
                  locations:
                    type: array
                    items:
                      $ref: '#/components/schemas/InventoryLocation'
                  summary:
                    type: array
                    items:
                      type: object

  /inventory/{productId}:
    get:
      tags:
        - Inventory
      summary: Get inventory for specific product
      security:
        - BearerAuth: []
      operationId: getProductInventory
      parameters:
        - name: productId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Product inventory details
          content:
            application/json:
              schema:
                type: object
                properties:
                  product:
                    $ref: '#/components/schemas/Product'
                  locations:
                    type: array
                    items:
                      $ref: '#/components/schemas/InventoryLocation'
                  totalQty:
                    type: integer
                  recentTransactions:
                    type: array
                    items:
                      $ref: '#/components/schemas/InventoryTransaction'

  /inventory/adjust:
    post:
      tags:
        - Inventory
      summary: Adjust stock quantity
      security:
        - BearerAuth: []
      operationId: adjustInventory
      x-requires-role: STOCK_CLERK
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - productId
                - warehouseId
                - qtyDelta
              properties:
                productId:
                  type: string
                warehouseId:
                  type: string
                qtyDelta:
                  type: integer
                  description: Positive to add, negative to remove
                reason:
                  type: string
                  enum: [ADJUSTMENT, DAMAGE, LOSS, CORRECTION]
                notes:
                  type: string
      responses:
        '200':
          description: Inventory adjusted
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/InventoryLocation'
        '400':
          description: Invalid adjustment (no negative stock)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /inventory/transfer:
    post:
      tags:
        - Inventory
      summary: Transfer stock between warehouses
      security:
        - BearerAuth: []
      operationId: transferInventory
      x-requires-role: STOCK_CLERK
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - productId
                - fromWarehouseId
                - toWarehouseId
                - qty
              properties:
                productId:
                  type: string
                fromWarehouseId:
                  type: string
                toWarehouseId:
                  type: string
                qty:
                  type: integer
                notes:
                  type: string
      responses:
        '200':
          description: Transfer completed
          content:
            application/json:
              schema:
                type: object
                properties:
                  from:
                    $ref: '#/components/schemas/InventoryLocation'
                  to:
                    $ref: '#/components/schemas/InventoryLocation'

  /inventory/recount:
    post:
      tags:
        - Inventory
      summary: Record physical inventory count
      security:
        - BearerAuth: []
      operationId: recountInventory
      x-requires-role: STOCK_CLERK
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - warehouseId
                - items
              properties:
                warehouseId:
                  type: string
                items:
                  type: array
                  items:
                    type: object
                    required:
                      - productId
                      - countedQty
                    properties:
                      productId:
                        type: string
                      countedQty:
                        type: integer
                countDate:
                  type: string
                  format: date
      responses:
        '200':
          description: Recount processed
          content:
            application/json:
              schema:
                type: object
                properties:
                  variance:
                    type: array
                    items:
                      type: object

  /users:
    get:
      tags:
        - Users
      summary: List all users
      security:
        - BearerAuth: []
      operationId: listUsers
      x-requires-role: ADMIN
      parameters:
        - name: role
          in: query
          schema:
            type: string
            enum: [ADMIN, MANAGER, CASHIER, STOCK_CLERK, SUPERVISOR]
        - name: isActive
          in: query
          schema:
            type: boolean
        - name: skip
          in: query
          schema:
            type: integer
            default: 0
        - name: take
          in: query
          schema:
            type: integer
            default: 50
      responses:
        '200':
          description: List of users
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
                  total:
                    type: integer

    post:
      tags:
        - Users
      summary: Create new user
      security:
        - BearerAuth: []
      operationId: createUser
      x-requires-role: ADMIN
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - email
                - password
                - firstName
                - role
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
                firstName:
                  type: string
                lastName:
                  type: string
                phone:
                  type: string
                department:
                  type: string
                role:
                  type: string
                  enum: [ADMIN, MANAGER, CASHIER, STOCK_CLERK, SUPERVISOR]
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

  /users/{id}:
    get:
      tags:
        - Users
      summary: Get user details
      security:
        - BearerAuth: []
      operationId: getUser
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: User details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found

    put:
      tags:
        - Users
      summary: Update user
      security:
        - BearerAuth: []
      operationId: updateUser
      x-requires-role: ADMIN
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                firstName:
                  type: string
                lastName:
                  type: string
                phone:
                  type: string
                department:
                  type: string
                role:
                  type: string
                isActive:
                  type: boolean
      responses:
        '200':
          description: User updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

    delete:
      tags:
        - Users
      summary: Delete user
      security:
        - BearerAuth: []
      operationId: deleteUser
      x-requires-role: ADMIN
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: User deleted
        '404':
          description: User not found

  /users/{id}/change-password:
    post:
      tags:
        - Users
      summary: Change another user's password (admin only)
      security:
        - BearerAuth: []
      operationId: changeUserPassword
      x-requires-role: ADMIN
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - newPassword
              properties:
                newPassword:
                  type: string
                  minLength: 8
      responses:
        '200':
          description: Password changed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

  /reports/sales-summary:
    get:
      tags:
        - Reports
      summary: Get sales summary by time period
      security:
        - BearerAuth: []
      operationId: getSalesSummary
      x-requires-role: MANAGER
      parameters:
        - name: dateFrom
          in: query
          schema:
            type: string
            format: date-time
        - name: dateTo
          in: query
          schema:
            type: string
            format: date-time
        - name: groupBy
          in: query
          schema:
            type: string
            enum: [day, week, month]
            default: day
      responses:
        '200':
          description: Sales summary
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    date:
                      type: string
                    sales:
                      type: integer
                    revenue:
                      type: integer
                    discount:
                      type: integer
                    tax:
                      type: integer

  /reports/sales-by-product:
    get:
      tags:
        - Reports
      summary: Get sales breakdown by product
      security:
        - BearerAuth: []
      operationId: getSalesByProduct
      x-requires-role: MANAGER
      parameters:
        - name: dateFrom
          in: query
          schema:
            type: string
            format: date-time
        - name: dateTo:
          in: query
          schema:
            type: string
            format: date-time
      responses:
        '200':
          description: Sales by product
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object

  /reports/inventory-summary:
    get:
      tags:
        - Reports
      summary: Get inventory summary and valuation
      security:
        - BearerAuth: []
      operationId: getInventorySummary
      x-requires-role: MANAGER
      responses:
        '200':
          description: Inventory summary
          content:
            application/json:
              schema:
                type: object

  /payments/process:
    post:
      tags:
        - Payments
      summary: Process payment
      security:
        - BearerAuth: []
      operationId: processPayment
      x-requires-role: CASHIER
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - saleId
                - amount
                - processor
              properties:
                saleId:
                  type: string
                amount:
                  type: integer
                  description: Amount in cents
                processor:
                  type: string
                  enum: [STRIPE, SQUARE, PAYPAL]
                cardToken:
                  type: string
                metadata:
                  type: object
      responses:
        '200':
          description: Payment processed
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                  transactionId:
                    type: string
                  amount:
                    type: integer
        '400':
          description: Payment failed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        email:
          type: string
          format: email
        firstName:
          type: string
        lastName:
          type: string
        phone:
          type: string
        role:
          type: string
          enum: [ADMIN, MANAGER, CASHIER, STOCK_CLERK, SUPERVISOR]
        isActive:
          type: boolean
        lastLogin:
          type: string
          format: date-time
        createdAt:
          type: string
          format: date-time

    UserWithTokens:
      allOf:
        - $ref: '#/components/schemas/User'
        - type: object
          properties:
            accessToken:
              type: string
            refreshToken:
              type: string

    TokenPair:
      type: object
      properties:
        accessToken:
          type: string
          description: JWT access token (15 min expiry)
        refreshToken:
          type: string
          description: JWT refresh token (7 days expiry)
        expiresIn:
          type: integer
          description: Seconds until access token expires

    Product:
      type: object
      properties:
        id:
          type: string
        sku:
          type: string
          description: Unique identifier
        barcode:
          type: string
        name:
          type: string
        description:
          type: string
        category:
          type: string
        priceCents:
          type: integer
        costCents:
          type: integer
        profitMarginCents:
          type: integer
        imageUrl:
          type: string
        isActive:
          type: boolean
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    Sale:
      type: object
      properties:
        id:
          type: string
        userId:
          type: string
        customerId:
          type: string
        saleNumber:
          type: string
        items:
          type: array
          items:
            type: object
            properties:
              productId:
                type: string
              qty:
                type: integer
              unitPrice:
                type: integer
              subtotalCents:
                type: integer
              discountCents:
                type: integer
        subtotalCents:
          type: integer
        discountCents:
          type: integer
        taxCents:
          type: integer
        totalCents:
          type: integer
        status:
          type: string
          enum: [completed, voided, refunded]
        createdAt:
          type: string
          format: date-time

    InventoryLocation:
      type: object
      properties:
        id:
          type: string
        product:
          $ref: '#/components/schemas/Product'
        warehouse:
          type: object
          properties:
            id:
              type: string
            name:
              type: string
            location:
              type: string
        qty:
          type: integer
        minThreshold:
          type: integer
        reorderPoint:
          type: integer
        lastCounted:
          type: string
          format: date-time

    InventoryTransaction:
      type: object
      properties:
        id:
          type: string
        productId:
          type: string
        warehouseId:
          type: string
        qtyBefore:
          type: integer
        qtyDelta:
          type: integer
        qtyAfter:
          type: integer
        type:
          type: string
          enum: [SOLD, ADJUSTMENT, TRANSFER, RECOUNT, RETURN]
        reason:
          type: string
        notes:
          type: string
        createdBy:
          type: string
        createdAt:
          type: string
          format: date-time

    Error:
      type: object
      properties:
        error:
          type: string
        code:
          type: string
        details:
          type: object
        timestamp:
          type: string
          format: date-time

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT access token required for protected endpoints

  responses:
    UnauthorizedError:
      description: Invalid or missing authentication token
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    ForbiddenError:
      description: User lacks required permissions
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    NotFoundError:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

x-rate-limits:
  login:
    requests: 5
    window: 15 minutes
    description: Prevent brute force attacks
  
  default:
    requests: 100
    window: 1 minute
    description: Standard API rate limit
  
  payment:
    requests: 10
    window: 1 hour
    description: Payment endpoint rate limit

x-error-codes:
  INVALID_EMAIL: "Email format is invalid"
  DUPLICATE_EMAIL: "Email already registered"
  INVALID_PASSWORD: "Password must be 8+ chars with mixed case"
  WRONG_PASSWORD: "Password incorrect"
  ACCOUNT_LOCKED: "Too many failed attempts - try again later"
  INVALID_TOKEN: "Token invalid or expired"
  INSUFFICIENT_STOCK: "Product out of stock"
  SKU_EXISTS: "SKU already exists"
  PERMISSION_DENIED: "User lacks required permission"
  ALREADY_REFUNDED: "Sale already refunded"
  NEGATIVE_STOCK: "Stock cannot go negative"
  INVALID_DISCOUNT: "Discount exceeds maximum"
```

## Rate Limits

All endpoints are subject to the following rate limits:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 5 requests | 15 minutes |
| `/auth/register` | 3 requests | 1 hour |
| All other endpoints | 100 requests | 1 minute |
| `/payments/process` | 10 requests | 1 hour |

Rate limit headers:
- `X-RateLimit-Limit`: Total requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Authentication

All protected endpoints require a `Bearer` token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Details

- **Access Token**: Valid for 15 minutes
- **Refresh Token**: Valid for 7 days
- **Token Type**: JWT (JSON Web Token)

### Token Refresh Flow

When access token expires:
1. Use refresh token to get new token pair
2. Update client-side tokens
3. Retry original request

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_EMAIL` | 400 | Email format is invalid |
| `DUPLICATE_EMAIL` | 409 | Email already registered |
| `INVALID_PASSWORD` | 400 | Password requirements not met |
| `WRONG_PASSWORD` | 401 | Incorrect credentials |
| `ACCOUNT_LOCKED` | 429 | Too many failed login attempts |
| `INVALID_TOKEN` | 401 | Token invalid, expired, or revoked |
| `INSUFFICIENT_STOCK` | 400 | Product not available in requested quantity |
| `SKU_EXISTS` | 409 | SKU already exists |
| `PERMISSION_DENIED` | 403 | User role lacks required permission |
| `NOT_FOUND` | 404 | Resource does not exist |
| `ALREADY_REFUNDED` | 400 | Sale already refunded |
| `NEGATIVE_STOCK` | 400 | Cannot reduce stock below zero |
| `INVALID_DISCOUNT` | 400 | Discount exceeds maximum (50% of subtotal) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Pagination

List endpoints support pagination with these query parameters:

- `skip` (default: 0): Number of records to skip
- `take` (default: 50, max: 1000): Number of records to return

```
GET /products?skip=0&take=20
```

Response includes:
```json
{
  "data": [...],
  "total": 1234,
  "skip": 0,
  "take": 20
}
```

## Filtering and Sorting

### Products
- Filter by: category, isActive
- Search by: name, SKU, barcode
- Sort by: name, price, sku, createdAt
- Sort order: asc, desc

### Sales
- Filter by: status, dateFrom, dateTo, customerId
- Sort by: createdAt, totalCents, saleNumber

### Users
- Filter by: role, isActive, department
- Sort by: email, firstName, createdAt

## Versioning Strategy

API version: **v1.0.0**

Current server: `https://api.aetherpos.local`

Future versions will be served at:
- `https://api.aetherpos.local/v2`
- `https://api.aetherpos.local/v3`

Deprecation notices will be included in response headers before removal.
