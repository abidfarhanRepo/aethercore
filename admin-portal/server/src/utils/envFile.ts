import fs from 'node:fs/promises'

export type EnvMap = Record<string, string>

export async function readEnvFile(filePath: string): Promise<EnvMap> {
  const out: EnvMap = {}
  const raw = await fs.readFile(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const eq = line.indexOf('=')
    if (eq <= 0) {
      continue
    }
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    out[key] = value
  }
  return out
}

export async function updateEnvFile(filePath: string, updates: EnvMap): Promise<void> {
  const raw = await fs.readFile(filePath, 'utf8')
  const lines = raw.split(/\r?\n/)
  const remaining = new Map(Object.entries(updates))

  const next = lines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      return line
    }

    const eq = line.indexOf('=')
    if (eq <= 0) {
      return line
    }

    const key = line.slice(0, eq).trim()
    if (!remaining.has(key)) {
      return line
    }

    const value = remaining.get(key) ?? ''
    remaining.delete(key)
    return `${key}=${value}`
  })

  for (const [key, value] of remaining.entries()) {
    next.push(`${key}=${value}`)
  }

  await fs.writeFile(filePath, `${next.join('\n').replace(/\n+$/g, '')}\n`, 'utf8')
}
