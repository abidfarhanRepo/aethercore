#!/usr/bin/env node

require('dotenv').config()
const { spawnSync } = require('child_process')

const gates = [
  {
    name: 'migration-drift',
    script: 'scripts/gate-migration-drift.js',
  },
  {
    name: 'pre-release-evidence',
    script: 'scripts/gate-pre-release-evidence.js',
  },
  {
    name: 'post-release-evidence',
    script: 'scripts/gate-post-release-evidence.js',
  },
]

function runGate(gate) {
  const startedAt = Date.now()
  const result = spawnSync(process.execPath, [gate.script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })

  const durationMs = Date.now() - startedAt
  const exitCode = typeof result.status === 'number' ? result.status : 1

  return {
    name: gate.name,
    exitCode,
    durationMs,
    pass: exitCode === 0,
  }
}

function runAllGates() {
  console.log('Running local release gates (no GitHub Actions).')
  console.log('')

  const summary = []

  for (const gate of gates) {
    console.log(`=== ${gate.name} ===`)
    const outcome = runGate(gate)
    summary.push(outcome)

    console.log(
      `Result: ${outcome.pass ? 'PASS' : 'FAIL'} (exit=${outcome.exitCode}, durationMs=${outcome.durationMs})`
    )
    console.log('')

    if (!outcome.pass) {
      break
    }
  }

  const allPassed = summary.length === gates.length && summary.every((item) => item.pass)

  console.log('Gate summary:')
  for (const item of summary) {
    console.log(`- ${item.name}: ${item.pass ? 'PASS' : 'FAIL'} (exit=${item.exitCode})`)
  }

  if (!allPassed) {
    console.error('Local release gating FAILED.')
    process.exit(1)
  }

  console.log('Local release gating PASSED.')
  process.exit(0)
}

runAllGates()
