import fs from 'node:fs/promises'
import path from 'node:path'
import { readEnvFile } from './envFile'
import { runCommand } from './process'

export type OrgSummary = {
  name: string
  createdAt: string
  env: Record<string, string>
  docker: {
    total: number
    healthy: number
    running: number
    unhealthy: number
    services: Array<Record<string, unknown>>
  }
  lastBackup: string | null
}

const rootDir = path.resolve(__dirname, '../../../..')
const deployDir = path.join(rootDir, 'deploy')
const orgsDir = path.join(deployDir, 'orgs')

export function validateOrgName(org: string): boolean {
  return /^[a-z0-9-]+$/.test(org)
}

export function getOrgDir(org: string): string {
  return path.join(orgsDir, org)
}

export function getOrgCompose(org: string): string {
  return path.join(getOrgDir(org), 'docker-compose.yml')
}

export function getOrgEnvFile(org: string): string {
  return path.join(getOrgDir(org), '.env')
}

export async function listOrgs(): Promise<string[]> {
  const entries = await fs.readdir(orgsDir, { withFileTypes: true })
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
}

function parseComposePsJson(output: string): Array<Record<string, unknown>> {
  const text = output.trim()
  if (!text) {
    return []
  }

  if (text.startsWith('[')) {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

export async function getOrgDockerHealth(org: string): Promise<OrgSummary['docker']> {
  const composeFile = getOrgCompose(org)
  const envFile = getOrgEnvFile(org)

  try {
    const { stdout } = await runCommand('docker', ['compose', '-f', composeFile, '--env-file', envFile, 'ps', '--format', 'json'])
    const services = parseComposePsJson(stdout)

    let healthy = 0
    let running = 0
    let unhealthy = 0

    for (const service of services) {
      const state = String(service.State || '').toLowerCase()
      const health = String(service.Health || '').toLowerCase()

      if (state === 'running') {
        running += 1
      }
      if (health === 'healthy') {
        healthy += 1
      }
      if (health === 'unhealthy' || state === 'exited' || state === 'dead') {
        unhealthy += 1
      }
    }

    return {
      total: services.length,
      healthy,
      running,
      unhealthy,
      services,
    }
  } catch {
    return {
      total: 0,
      healthy: 0,
      running: 0,
      unhealthy: 0,
      services: [],
    }
  }
}

export async function getLastBackup(org: string): Promise<string | null> {
  const primaryDir = path.join('/backups', org)
  const fallbackDir = path.join(deployDir, 'backups', org)
  const backupDir = await resolveExistingDir(primaryDir, fallbackDir)

  if (!backupDir) {
    return null
  }

  const files = await fs.readdir(backupDir)
  const sqlFiles = files.filter((name) => name.endsWith('.sql.gz'))

  if (sqlFiles.length === 0) {
    return null
  }

  let newest: { mtimeMs: number; iso: string } | null = null
  for (const file of sqlFiles) {
    const full = path.join(backupDir, file)
    const stat = await fs.stat(full)
    if (!newest || stat.mtimeMs > newest.mtimeMs) {
      newest = { mtimeMs: stat.mtimeMs, iso: stat.mtime.toISOString() }
    }
  }

  return newest?.iso ?? null
}

async function resolveExistingDir(...candidateDirs: string[]): Promise<string | null> {
  for (const candidate of candidateDirs) {
    try {
      const stat = await fs.stat(candidate)
      if (stat.isDirectory()) {
        return candidate
      }
    } catch {
      // Ignore not-found candidates.
    }
  }
  return null
}

export async function getOrgSummary(org: string): Promise<OrgSummary> {
  const orgDir = getOrgDir(org)
  const envFile = getOrgEnvFile(org)

  const [orgStat, env, docker, lastBackup] = await Promise.all([
    fs.stat(orgDir),
    readEnvFile(envFile),
    getOrgDockerHealth(org),
    getLastBackup(org),
  ])

  return {
    name: org,
    createdAt: orgStat.birthtime.toISOString(),
    env,
    docker,
    lastBackup,
  }
}
