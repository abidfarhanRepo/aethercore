-- Add explicit security event types used by W1-09 frontend security transport.
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'MFA_FAILED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'CAPABILITY_DENIED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'IDLE_LOCK';
