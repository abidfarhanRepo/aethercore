#!/usr/bin/env powershell

# Performance Optimization Validation Script
# Run this script to validate all optimization implementations
# Usage: .\validate-optimizations.ps1

function Check-File {
    param(
        [string]$Path,
        [string]$Description
    )
    
    if (Test-Path $Path) {
        Write-Host "✓ $Description" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ $Description - NOT FOUND" -ForegroundColor Red
        return $false
    }
}

function Test-Port {
    param(
        [int]$Port,
        [string]$Service
    )
    
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
    if ($connection.TcpTestSucceeded) {
        Write-Host "✓ $Service running on port $Port" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ $Service not responding on port $Port" -ForegroundColor Yellow
        return $false
    }
}

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Aether POS - Performance Optimization Validation" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check Backend Optimization Files
Write-Host "Checking Backend Optimization Files..." -ForegroundColor Yellow
Write-Host "─────────────────────────────────────" -ForegroundColor Yellow

$backendFiles = @(
    @{ Path = "backend/src/lib/caching.ts"; Desc = "Redis Cache Wrapper" },
    @{ Path = "backend/src/lib/queries.ts"; Desc = "Query Optimization" },
    @{ Path = "backend/src/lib/queue.ts"; Desc = "Job Queue System" },
    @{ Path = "backend/src/lib/rateLimiter.ts"; Desc = "Rate Limiter" },
    @{ Path = "backend/src/lib/performance.ts"; Desc = "Performance Monitoring" },
    @{ Path = "backend/src/middleware/compression.ts"; Desc = "Response Compression" },
    @{ Path = "backend/src/middleware/caching.ts"; Desc = "HTTP Cache Headers" }
)

$backendCount = 0
foreach ($file in $backendFiles) {
    if (Check-File $file.Path $file.Desc) {
        $backendCount++
    }
}

Write-Host ""
Write-Host "Frontend Optimization Files..." -ForegroundColor Yellow
Write-Host "─────────────────────────────────────" -ForegroundColor Yellow

$frontendFiles = @(
    @{ Path = "frontend/src/lib/hooks/useOptimizedData.ts"; Desc = "Optimized Data Hooks" },
    @{ Path = "frontend/src/lib/apiOptimization.ts"; Desc = "API Optimization Utilities" },
    @{ Path = "frontend/src/components/VirtualProductList.tsx"; Desc = "Virtual List Component" },
    @{ Path = "frontend/src/lib/performance.ts"; Desc = "Frontend Performance Tracking" },
    @{ Path = "frontend/vite.config.optimized.ts"; Desc = "Optimized Vite Config" },
    @{ Path = "frontend/src/service-worker-optimized.ts"; Desc = "Optimized Service Worker" }
)

$frontendCount = 0
foreach ($file in $frontendFiles) {
    if (Check-File $file.Path $file.Desc) {
        $frontendCount++
    }
}

Write-Host ""
Write-Host "Database Optimization Files..." -ForegroundColor Yellow
Write-Host "─────────────────────────────────────" -ForegroundColor Yellow

$dbFiles = @(
    @{ Path = "backend/prisma/migrations/20260304000000_add_performance_indexes"; Desc = "Performance Indexes Migration" }
)

$dbCount = 0
foreach ($file in $dbFiles) {
    if (Check-File $file.Path $file.Desc) {
        $dbCount++
    }
}

Write-Host ""
Write-Host "Load Testing Files..." -ForegroundColor Yellow
Write-Host "─────────────────────────────────────" -ForegroundColor Yellow

$testFiles = @(
    @{ Path = "infra/k6/backend-load-test.js"; Desc = "Backend Load Test (k6)" },
    @{ Path = "infra/k6/frontend-load-test.js"; Desc = "Frontend Load Test (k6)" }
)

$testCount = 0
foreach ($file in $testFiles) {
    if (Check-File $file.Path $file.Desc) {
        $testCount++
    }
}

Write-Host ""
Write-Host "Documentation Files..." -ForegroundColor Yellow
Write-Host "─────────────────────────────────────" -ForegroundColor Yellow

$docFiles = @(
    @{ Path = "PERFORMANCE.md"; Desc = "Performance Optimization Guide" },
    @{ Path = "OPTIMIZATION_CHECKLIST.md"; Desc = "Optimization Checklist" },
    @{ Path = "PERFORMANCE_INTEGRATION_GUIDE.md"; Desc = "Integration Guide" },
    @{ Path = "PERFORMANCE_IMPLEMENTATION_SUMMARY.md"; Desc = "Implementation Summary" },
    @{ Path = "PERFORMANCE_BENCHMARKS.md"; Desc = "Benchmark Results" }
)

$docCount = 0
foreach ($file in $docFiles) {
    if (Check-File $file.Path $file.Desc) {
        $docCount++
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Service Status Check" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "Checking Services..." -ForegroundColor Yellow
Write-Host "─────────────────────────────────────" -ForegroundColor Yellow

# Check if services are running
$backendRunning = Test-Port 4000 "Backend API"
$frontendRunning = Test-Port 5173 "Frontend Dev Server"
$redisRunning = Test-Port 6379 "Redis"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "Backend Optimization Files:   $backendCount/$($backendFiles.Length) ✓" -ForegroundColor Green
Write-Host "Frontend Optimization Files:  $frontendCount/$($frontendFiles.Length) ✓" -ForegroundColor Green
Write-Host "Database Optimization Files:  $dbCount/$($dbFiles.Length) ✓" -ForegroundColor Green
Write-Host "Load Testing Files:           $testCount/$($testFiles.Length) ✓" -ForegroundColor Green
Write-Host "Documentation Files:          $docCount/$($docFiles.Length) ✓" -ForegroundColor Green

Write-Host ""
$totalFiles = $backendCount + $frontendCount + $dbCount + $testCount + $docCount
$expectedFiles = $backendFiles.Length + $frontendFiles.Length + $dbFiles.Length + $testFiles.Length + $docFiles.Length

Write-Host "Total Optimization Files: $totalFiles/$expectedFiles" -ForegroundColor Cyan

Write-Host ""
Write-Host "Services Running:" -ForegroundColor Cyan
if ($backendRunning) { Write-Host "  ✓ Backend API (http://localhost:4000)" } else { Write-Host "  ⚠ Backend API (start with: npm run dev)" }
if ($frontendRunning) { Write-Host "  ✓ Frontend Dev (http://localhost:5173)" } else { Write-Host "  ⚠ Frontend Dev (start with: npm run dev)" }
if ($redisRunning) { Write-Host "  ✓ Redis (redis://localhost:6379)" } else { Write-Host "  ⚠ Redis (start with: redis-server)" }

Write-Host ""

if ($totalFiles -eq $expectedFiles) {
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✓ ALL OPTIMIZATION FILES PRESENT" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
} else {
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "  ⚠ Some files may be missing" -ForegroundColor Yellow
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Start services:" -ForegroundColor Yellow
Write-Host "   cd backend && npm run dev" -ForegroundColor Gray
Write-Host "   cd frontend && npm run dev" -ForegroundColor Gray
Write-Host "   redis-server" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Run load tests:" -ForegroundColor Yellow
Write-Host "   k6 run infra/k6/backend-load-test.js" -ForegroundColor Gray
Write-Host "   k6 run infra/k6/frontend-load-test.js" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Check metrics:" -ForegroundColor Yellow
Write-Host "   curl http://localhost:4000/metrics" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Read documentation:" -ForegroundColor Yellow
Write-Host "   PERFORMANCE.md - Complete guide" -ForegroundColor Gray
Write-Host "   PERFORMANCE_INTEGRATION_GUIDE.md - Quick start" -ForegroundColor Gray
Write-Host "   OPTIMIZATION_CHECKLIST.md - Production checklist" -ForegroundColor Gray
Write-Host ""
