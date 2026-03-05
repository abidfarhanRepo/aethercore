-- Phase 5 offline and sync reliability additions

ALTER TABLE "Sale"
ADD COLUMN "receiptPublicId" TEXT,
ADD COLUMN "terminalId" TEXT,
ADD COLUMN "offlineOpId" TEXT,
ADD COLUMN "syncState" TEXT NOT NULL DEFAULT 'online_created',
ADD COLUMN "clientCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Sale_receiptPublicId_key" ON "Sale"("receiptPublicId");
CREATE UNIQUE INDEX "Sale_offlineOpId_key" ON "Sale"("offlineOpId");
CREATE INDEX "Sale_terminalId_idx" ON "Sale"("terminalId");
CREATE INDEX "Sale_syncState_idx" ON "Sale"("syncState");
CREATE INDEX "Sale_clientCreatedAt_idx" ON "Sale"("clientCreatedAt");

CREATE TABLE "SyncDeadLetter" (
  "id" TEXT NOT NULL,
  "terminalId" TEXT,
  "offlineOpId" TEXT,
  "endpoint" TEXT NOT NULL,
  "operationType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "errorCode" TEXT,
  "errorDetail" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastFailedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "SyncDeadLetter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SyncDeadLetter_offlineOpId_key" ON "SyncDeadLetter"("offlineOpId");
CREATE INDEX "SyncDeadLetter_status_idx" ON "SyncDeadLetter"("status");
CREATE INDEX "SyncDeadLetter_endpoint_idx" ON "SyncDeadLetter"("endpoint");
CREATE INDEX "SyncDeadLetter_createdAt_idx" ON "SyncDeadLetter"("createdAt");
CREATE INDEX "SyncDeadLetter_terminalId_idx" ON "SyncDeadLetter"("terminalId");
