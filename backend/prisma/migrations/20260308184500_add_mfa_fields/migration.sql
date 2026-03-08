-- Add MFA fields to users for TOTP enrollment and recovery-code fallback.
ALTER TABLE "User"
ADD COLUMN "mfaSecret" TEXT,
ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfaRecoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "User"
SET "mfaRecoveryCodes" = ARRAY[]::TEXT[]
WHERE "mfaRecoveryCodes" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "mfaRecoveryCodes" SET NOT NULL;
