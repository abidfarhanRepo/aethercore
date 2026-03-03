const { PrismaClient } = require('@prisma/client');

async function setupDatabase() {
  const prisma = new PrismaClient();
  
  try {
    // Try to create a simple user - if the table exists it will work
    // If it doesn't exist, we'll get an error that tells us the table is missing
    const result = await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        id TEXT NOT NULL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        "firstName" TEXT,
        "lastName" TEXT,
        phone TEXT,
        department TEXT,
        "managerId" TEXT,
        role TEXT NOT NULL DEFAULT 'CASHIER',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "lastLogin" TIMESTAMP(3),
        "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
        "lockedAt" TIMESTAMP(3),
        "passwordResetToken" TEXT,
        "passwordResetExpiry" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ User table created or already exists');
    
    // Create other essential tables
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RefreshToken" (
        token TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ RefreshToken table created or already exists');
    
    // Create AuditLog table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        id TEXT NOT NULL PRIMARY KEY,
        action TEXT NOT NULL,
        "actorId" TEXT,
        "resourceType" TEXT,
        "resourceId" TEXT,
        details JSONB,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ AuditLog table created or already exists');
    
  } catch (error) {
    console.error('Error setting up database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

setupDatabase();
