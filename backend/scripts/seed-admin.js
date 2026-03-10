#!/usr/bin/env node

const crypto = require('crypto')
const { PrismaClient, TenantProfile } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue

    const [keyRaw, inlineValue] = arg.slice(2).split('=')
    const key = keyRaw.trim()

    if (inlineValue !== undefined) {
      out[key] = inlineValue.trim()
      continue
    }

    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next.trim()
      i += 1
    } else {
      out[key] = 'true'
    }
  }
  return out
}

function normalizeOrgSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function slugToTenantName(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const email = args.email
  if (!email) {
    throw new Error('Missing required argument: --email')
  }

  const orgSlug = normalizeOrgSlug(args.org || process.env.ORG_NAME || 'default')
  if (!orgSlug) {
    throw new Error('Unable to derive org slug. Pass --org <slug> or set ORG_NAME.')
  }

  const temporaryPassword = args.password || crypto.randomBytes(10).toString('hex')
  const passwordHash = await bcrypt.hash(temporaryPassword, 10)

  const tenantCode = orgSlug.toUpperCase().replace(/-/g, '_')
  const tenantName = slugToTenantName(orgSlug) || 'Aether Tenant'

  const tenant = await prisma.tenant.upsert({
    where: { code: tenantCode },
    update: {
      name: tenantName,
      isActive: true,
      profile: TenantProfile.GENERAL,
    },
    create: {
      code: tenantCode,
      name: tenantName,
      profile: TenantProfile.GENERAL,
      isActive: true,
    },
  })

  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      idleTimeoutMinutes: 10,
    },
  })

  await prisma.user.upsert({
    where: { email },
    update: {
      role: 'ADMIN',
      tenantId: tenant.id,
      password: passwordHash,
      isActive: true,
      mfaEnabled: false,
    },
    create: {
      email,
      password: passwordHash,
      role: 'ADMIN',
      tenantId: tenant.id,
      isActive: true,
      mfaEnabled: false,
      mfaRecoveryCodes: [],
    },
  })

  const result = {
    ok: true,
    email,
    orgSlug,
    tenantCode,
    temporaryPassword,
  }

  console.log(JSON.stringify(result))
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
