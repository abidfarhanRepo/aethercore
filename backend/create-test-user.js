const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function createUser() {
  const prisma = new PrismaClient();
  try {
    const hash = await bcrypt.hash('Secure#1234', 10);
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: hash,
        isActive: true,
        failedLoginAttempts: 0,
      }
    });
    console.log('✅ User created:', JSON.stringify(user, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createUser();
