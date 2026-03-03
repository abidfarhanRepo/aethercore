-- AlterTable
ALTER TABLE "User" ADD COLUMN "department" TEXT,
ADD COLUMN "managerId" TEXT,
ADD COLUMN "lastLogin" TIMESTAMP(3),
ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "passwordResetToken" TEXT,
ADD COLUMN "passwordResetExpiry" TIMESTAMP(3),
ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "User_department_idx" ON "User"("department");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateTable
CREATE TABLE "CustomRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customRoleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomRole_name_key" ON "CustomRole"("name");
CREATE INDEX "CustomRole_name_idx" ON "CustomRole"("name");
CREATE INDEX "CustomRole_isActive_idx" ON "CustomRole"("isActive");
CREATE UNIQUE INDEX "UserRole_userId_customRoleId_key" ON "UserRole"("userId", "customRoleId");
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");
CREATE INDEX "UserRole_customRoleId_idx" ON "UserRole"("customRoleId");
CREATE INDEX "PermissionLog_userId_idx" ON "PermissionLog"("userId");
CREATE INDEX "PermissionLog_action_idx" ON "PermissionLog"("action");
CREATE INDEX "PermissionLog_timestamp_idx" ON "PermissionLog"("timestamp");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermissionLog" ADD CONSTRAINT "PermissionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
