import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const rootDir = path.resolve(__dirname, '../../../..')

function resolveScriptShell(): string {
  if (process.env.SCRIPT_SHELL) {
    return process.env.SCRIPT_SHELL
  }

  if (process.platform === 'win32') {
    const candidates = ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe']
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }
  }

  return 'bash'
}

const scriptShell = resolveScriptShell()

export type ExecResult = {
  stdout: string
  stderr: string
}

export type ExecOptions = {
  env?: NodeJS.ProcessEnv
}

export function runCommand(file: string, args: string[], cwd = rootDir, options: ExecOptions = {}): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { cwd, maxBuffer: 5 * 1024 * 1024, env: options.env }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error((stderr || error.message).trim() || 'Command failed'))
        return
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() })
    })
  })
}

export function runScript(scriptRelativePath: string, scriptArgs: string[], cwd = rootDir, options: ExecOptions = {}): Promise<ExecResult> {
  const scriptPath = path.join(rootDir, scriptRelativePath)
  let shellPath = scriptPath
  if (scriptShell.toLowerCase().includes('bash')) {
    shellPath = scriptPath.replace(/\\/g, '/')
    const isGitBash = scriptShell.toLowerCase().includes('git/bin/bash.exe') || scriptShell.toLowerCase().includes('git/usr/bin/bash.exe')
    if (!isGitBash && /^[A-Za-z]:\//.test(shellPath)) {
      shellPath = `/${shellPath[0].toLowerCase()}${shellPath.slice(2)}`
    }
  }
  return runCommand(scriptShell, [shellPath, ...scriptArgs], cwd, options)
}
