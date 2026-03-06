#!/usr/bin/env pwsh
<#!
.SYNOPSIS
  Run Phase 8 integration tests against a remote Postgres (e.g., Neon).

.DESCRIPTION
  - Uses TEST_DATABASE_URL if present; otherwise falls back to existing DATABASE_URL.
  - Uses Prisma db push for test schema sync.
  - Runs only the Phase 8 integration tests with default reporter.

.EXAMPLE
  $env:TEST_DATABASE_URL = "postgresql://..."
  ./run-phase8-integration-tests.ps1
#>

$ErrorActionPreference = 'Stop'

function Import-DotEnvIfPresent {
  param(
    [string]$Path
  )

  if (-not (Test-Path $Path)) {
    return
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { return }
    if ($line.StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }

    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()

    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    if (-not [string]::IsNullOrWhiteSpace($name)) {
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

# If DB env vars are not present in shell, attempt to load backend/.env.
if (-not $env:TEST_DATABASE_URL -and -not $env:DATABASE_URL) {
  Import-DotEnvIfPresent -Path (Join-Path $PSScriptRoot '.env')
}

$resolvedDbUrl = $env:TEST_DATABASE_URL
if (-not $resolvedDbUrl) {
  $resolvedDbUrl = $env:DATABASE_URL
}

if (-not $resolvedDbUrl) {
  Write-Host "ERROR: Neither TEST_DATABASE_URL nor DATABASE_URL is set." -ForegroundColor Red
  Write-Host "Set one of them to your Neon direct connection string, then rerun." -ForegroundColor Yellow
  Write-Host "Example:" -ForegroundColor Yellow
  Write-Host '  $env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST/DB?sslmode=require"' -ForegroundColor Gray
  exit 1
}

# Ensure tests do not depend on a local Redis.
if (-not $env:TEST_REDIS_URL) {
  $env:TEST_REDIS_URL = 'redis://localhost:6379/1'
}

if (-not $env:JWT_ACCESS_SECRET) {
  $env:JWT_ACCESS_SECRET = 'test_access_secret_key_for_testing_only'
}

if (-not $env:JWT_REFRESH_SECRET) {
  $env:JWT_REFRESH_SECRET = 'test_refresh_secret_key_for_testing_only'
}

Write-Host "[1/3] Prisma generate" -ForegroundColor Cyan
npx prisma generate

Write-Host "[2/3] Sync test schema (prisma db push)" -ForegroundColor Cyan
$env:TEST_DATABASE_URL = $resolvedDbUrl
$env:DATABASE_URL = $resolvedDbUrl
npx prisma db push --accept-data-loss

Write-Host "[3/3] Run Phase 8 integration tests" -ForegroundColor Cyan
npx jest __tests__/integration/health.integration.test.ts __tests__/integration/security-status.integration.test.ts --runInBand --reporters=default
