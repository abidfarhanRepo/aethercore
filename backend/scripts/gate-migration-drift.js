#!/usr/bin/env node

require('dotenv').config()
const { spawnSync } = require('child_process')
const path = require('path')
const { writeEvidence } = require('./release-gate-utils')

function resolveNpxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

function run() {
  const command = resolveNpxCommand()
  const args = [
    'prisma',
    'migrate',
    'diff',
    '--from-migrations',
    path.join('prisma', 'migrations'),
    '--to-schema-datamodel',
    path.join('prisma', 'schema.prisma'),
    '--exit-code',
  ]

  const startedAt = Date.now()
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  })
  const durationMs = Date.now() - startedAt

  const exitCode = typeof result.status === 'number' ? result.status : 1
  const driftDetected = exitCode === 2
  const pass = exitCode === 0

  const evidence = {
    pass,
    driftDetected,
    exitCode,
    durationMs,
    command: `${command} ${args.join(' ')}`,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  }

  const files = writeEvidence('migration-drift-gate', evidence)

  console.log(`Migration drift gate ${pass ? 'PASSED' : 'FAILED'}`)
  console.log(`artifact=${files.filePath}`)
  console.log(`artifact_latest=${files.stablePath}`)

  if (!pass) {
    if (driftDetected) {
      console.error('Schema drift detected between Prisma migrations and schema.prisma.')
    } else {
      console.error('Unable to complete Prisma migration drift check.')
    }
    process.exit(1)
  }

  process.exit(0)
}

run()
