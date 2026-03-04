-- Make actorId in AuditLog table nullable to support logging events that happen before user authentication

ALTER TABLE "AuditLog" ALTER COLUMN "actorId" DROP NOT NULL;
