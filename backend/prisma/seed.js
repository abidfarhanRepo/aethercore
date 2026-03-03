const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aether.dev' },
    update: {},
    create: {
      email: 'admin@aether.dev',
      password: passwordHash,
      role: 'ADMIN'
    }
  })

  const p1 = await prisma.product.upsert({
    where: { sku: 'SKU-001' },
    update: {},
    create: {
      sku: 'SKU-001',
      name: 'Sample Product 1',
      description: 'Demo product',
      priceCents: 1000,
      costCents: 600
    }
  })

  console.log('Seed complete:', { admin: admin.email, product: p1.sku })
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
