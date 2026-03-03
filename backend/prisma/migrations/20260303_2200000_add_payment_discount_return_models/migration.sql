-- Add subtotalCents column to Sale
ALTER TABLE "Sale" ADD COLUMN "subtotalCents" INTEGER NOT NULL DEFAULT 0;

-- Create SalePayment table
CREATE TABLE "SalePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE
);

-- Create SaleDiscount table
CREATE TABLE "SaleDiscount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleDiscount_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE
);

-- Create SaleReturn table
CREATE TABLE "SaleReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "refundAmountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE,
    CONSTRAINT "SaleReturn_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SaleItem" ("id")
);

-- Create indexes
CREATE INDEX "SalePayment_saleId_idx" ON "SalePayment"("saleId");
CREATE INDEX "SalePayment_method_idx" ON "SalePayment"("method");
CREATE INDEX "SaleDiscount_saleId_idx" ON "SaleDiscount"("saleId");
CREATE INDEX "SaleDiscount_reason_idx" ON "SaleDiscount"("reason");
CREATE INDEX "SaleReturn_saleId_idx" ON "SaleReturn"("saleId");
CREATE INDEX "SaleReturn_itemId_idx" ON "SaleReturn"("itemId");
