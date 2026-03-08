-- Create tenant-scoped settings with idle timeout defaults.
CREATE TABLE "TenantSettings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "idleTimeoutMinutes" INTEGER NOT NULL DEFAULT 10,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantSettings_tenantId_key" ON "TenantSettings"("tenantId");
CREATE INDEX "TenantSettings_tenantId_idx" ON "TenantSettings"("tenantId");

ALTER TABLE "TenantSettings"
ADD CONSTRAINT "TenantSettings_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
