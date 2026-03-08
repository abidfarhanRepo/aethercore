-- Add PIN hash field for idle-lock unlock support.
ALTER TABLE "User"
ADD COLUMN "pinHash" TEXT;
