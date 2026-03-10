-- CreateTable
CREATE TABLE "InventoryHold" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'global',
    "quantity" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryHold_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InventoryHold"
ADD CONSTRAINT "InventoryHold_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "InventoryHold_productId_idx" ON "InventoryHold"("productId");
CREATE INDEX "InventoryHold_tenantId_idx" ON "InventoryHold"("tenantId");
CREATE INDEX "InventoryHold_expiresAt_idx" ON "InventoryHold"("expiresAt");
CREATE INDEX "InventoryHold_sessionId_idx" ON "InventoryHold"("sessionId");
