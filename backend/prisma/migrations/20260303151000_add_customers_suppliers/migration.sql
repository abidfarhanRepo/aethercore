-- CreateTable Customer
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "segment" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable Supplier
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "paymentTerms" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- Add Customer references to Sale
ALTER TABLE "Sale" ADD COLUMN "customerId" TEXT;

-- Add Supplier references to PurchaseOrder
ALTER TABLE "PurchaseOrder" ADD COLUMN "supplierId" TEXT NOT NULL;
ALTER TABLE "PurchaseOrder" ADD COLUMN "poNumber" TEXT NOT NULL;
ALTER TABLE "PurchaseOrder" ADD COLUMN "notes" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "expectedDelivery" TIMESTAMP(3);

-- Add qtyReceived to PurchaseOrderItem
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "qtyReceived" INTEGER NOT NULL DEFAULT 0;

-- Update Sale model fields
ALTER TABLE "Sale" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "taxCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'CASH';
ALTER TABLE "Sale" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE "Sale" ADD COLUMN "notes" TEXT;
ALTER TABLE "Sale" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update SaleItem model fields
ALTER TABLE "SaleItem" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SaleItem" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update Product model fields
ALTER TABLE "Product" ADD COLUMN "barcode" TEXT;
ALTER TABLE "Product" ADD COLUMN "category" TEXT;
ALTER TABLE "Product" ADD COLUMN "subcategory" TEXT;
ALTER TABLE "Product" ADD COLUMN "profitMarginCents" INTEGER;
ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update User model fields
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update InventoryTransaction model fields
ALTER TABLE "InventoryTransaction" ADD COLUMN "reference" TEXT;
ALTER TABLE "InventoryTransaction" ADD COLUMN "notes" TEXT;

-- Update AuditLog model fields
ALTER TABLE "AuditLog" ADD COLUMN "resource" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "resourceId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "ipAddress" TEXT;

-- Create indexes for Customer
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
CREATE INDEX "Customer_segment_idx" ON "Customer"("segment");
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- Create indexes for Supplier
CREATE UNIQUE INDEX "Supplier_email_key" ON "Supplier"("email");
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- Create unique indexes
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- Create indexes for Sale enhancements
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");
CREATE INDEX "Sale_paymentMethod_idx" ON "Sale"("paymentMethod");

-- Add foreign key for Customer
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign key for Supplier
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
