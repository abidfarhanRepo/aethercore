-- CreateIndex
CREATE INDEX idx_sale_created_date ON "Sale"("createdAt" DESC);

-- Index for product lookups by SKU
CREATE INDEX idx_product_sku ON "Product"("sku");

-- Index for inventory queries
CREATE INDEX idx_inventory_product_qty ON "InventoryLocation"("productId", "qty");

-- Index for user queries
CREATE INDEX idx_user_email ON "User"("email");

-- Composite indexes for common query patterns
CREATE INDEX idx_sale_user_created ON "Sale"("userId", "createdAt" DESC);

CREATE INDEX idx_sale_created_status ON "Sale"("createdAt" DESC, "status");

CREATE INDEX idx_product_active_created ON "Product"("isActive", "createdAt" DESC);

CREATE INDEX idx_inventory_location ON "InventoryLocation"("warehouseId", "productId");

-- Index for audit logs
CREATE INDEX idx_audit_log_created ON "AuditLog"("createdAt" DESC);

CREATE INDEX idx_audit_log_user ON "AuditLog"("actorId", "createdAt" DESC);

-- Index for purchase orders
CREATE INDEX idx_purchase_order_created ON "PurchaseOrder"("createdAt" DESC);

-- Index for product categories
CREATE INDEX idx_product_category ON "Product"("category");
