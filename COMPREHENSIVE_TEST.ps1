#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Comprehensive test suite for all AetherCore fixes
.DESCRIPTION
    Tests all four major bug fixes:
    1. 401 Authentication Errors (JWT verification, token refresh)
    2. 404 Missing Reports Endpoint
    3. 400 Payment Validation (Discount Calculation)
    4. Modal CSS Overflow (Visual - manual verification)
#>

Write-Host "`n" -NoNewline
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     AetherCore Comprehensive Bug Fix Verification Suite     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$baseUrl = "http://localhost:4000"
$results = @()

# ============================================================================
# TEST 1: Login & Authentication (Primary Fix for 401 Errors)
# ============================================================================
Write-Host "`n[TEST 1/4] Login & JWT Authentication" -ForegroundColor Yellow
Write-Host "Testing: POST /api/auth/login with JWT token generation" -ForegroundColor Gray
Write-Host "Fix: Corrected JWT verification method and token format" -ForegroundColor Gray
Write-Host "Expected: Access token returned successfully" -ForegroundColor Gray

try {
  $loginPayload = @{
    email = "test@example.com"
    password = "TestPass#123"
  } | ConvertTo-Json
  
  $response = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" `
    -Method POST `
    -Headers @{"Content-Type" = "application/json"} `
    -Body $loginPayload `
    -TimeoutSec 5 `
    -ErrorAction Stop
  
  $data = $response.Content | ConvertFrom-Json
  
  if ($data.accessToken) {
    Write-Host "✓ PASS: Login successful" -ForegroundColor Green
    Write-Host "  • Access Token: $($data.accessToken.Substring(0,30))..." -ForegroundColor Green
    Write-Host "  • Refresh Token: $($data.refreshToken.Substring(0,30))..." -ForegroundColor Green
    $results += "LOGIN: PASS"
    $TOKEN = $data.accessToken
  } else {
    Write-Host "✗ FAIL: No token in response" -ForegroundColor Red
    Write-Host "  Response: $($response.Content)" -ForegroundColor Red
    $results += "LOGIN: FAIL"
  }
} catch {
  Write-Host "✗ FAIL: Login request failed" -ForegroundColor Red
  Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
  $results += "LOGIN: ERROR"
}

# ============================================================================
# TEST 2: Get Current User (Tests 401 Fix in /api/auth/me)
# ============================================================================
Write-Host "`n[TEST 2/4] Get Current User - JWT Verification" -ForegroundColor Yellow
Write-Host "Testing: GET /api/auth/me with Bearer token" -ForegroundColor Gray
Write-Host "Fix: Changed from direct jwt.verify() to verifyAccessToken() function" -ForegroundColor Gray
Write-Host "Expected: User object returned without 401 error" -ForegroundColor Gray

try {
  if (-not $TOKEN) {
    Write-Host "✗ SKIP: No token available from previous test" -ForegroundColor Yellow
    $results += "GET_USER: SKIP"
  } else {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/auth/me" `
      -Method GET `
      -Headers @{"Authorization" = "Bearer $TOKEN"} `
      -TimeoutSec 5 `
      -ErrorAction Stop
    
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.id -and $data.email) {
      Write-Host "✓ PASS: User retrieved without 401 error" -ForegroundColor Green
      Write-Host "  • User ID: $($data.id)" -ForegroundColor Green
      Write-Host "  • Email: $($data.email)" -ForegroundColor Green
      Write-Host "  • Role: $($data.role)" -ForegroundColor Green
      $results += "GET_USER: PASS"
    } else {
      Write-Host "✗ FAIL: Invalid user data returned" -ForegroundColor Red
      Write-Host "  Response: $($response.Content)" -ForegroundColor Red
      $results += "GET_USER: FAIL"
    }
  }
} catch {
  Write-Host "✗ FAIL: Get user request failed" -ForegroundColor Red
  Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
  $results += "GET_USER: ERROR"
}

# ============================================================================
# TEST 3: Daily Sales Report (404 -> Working Fix)
# ============================================================================
Write-Host "`n[TEST 3/4] Daily Sales Reports Endpoint" -ForegroundColor Yellow
Write-Host "Testing: GET /api/reports/daily-sales" -ForegroundColor Gray
Write-Host "Fix: Created missing endpoint that was returning 404" -ForegroundColor Gray
Write-Host "Expected: 24 hourly sales records returned" -ForegroundColor Gray

try {
  if (-not $TOKEN) {
    Write-Host "✗ SKIP: No token available" -ForegroundColor Yellow
    $results += "REPORTS: SKIP"
  } else {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/reports/daily-sales" `
      -Method GET `
      -Headers @{"Authorization" = "Bearer $TOKEN"} `
      -TimeoutSec 5 `
      -ErrorAction Stop
    
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.hourly -and $data.hourly.Count -gt 0) {
      Write-Host "✓ PASS: Daily sales report retrieved" -ForegroundColor Green
      Write-Host "  • Hourly records: $($data.hourly.Count)" -ForegroundColor Green
      Write-Host "  • Total sales (cents): $($data.hourly | Measure-Object -Property totalCents -Sum | Select-Object -ExpandProperty Sum)" -ForegroundColor Green
      $results += "REPORTS: PASS"
    } else {
      Write-Host "⚠ WARN: Endpoint works but no data" -ForegroundColor Yellow
      Write-Host "  Response: $($response.Content)" -ForegroundColor Yellow
      $results += "REPORTS: WARN"
    }
  }
} catch {
  Write-Host "✗ FAIL: Reports endpoint request failed" -ForegroundColor Red
  Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
  $results += "REPORTS: ERROR"
}

# ============================================================================
# TEST 4: Sale with Discount Calculation (400 Validation Fix)
# ============================================================================
Write-Host "`n[TEST 4/4] Sale Creation with Discount" -ForegroundColor Yellow
Write-Host "Testing: POST /api/sales with discount calculation validation" -ForegroundColor Gray
Write-Host "Fix: Tax calculation now on (subtotal - discount) not full subtotal" -ForegroundColor Gray
Write-Host "Expected: Sale created with correct payment matching" -ForegroundColor Gray

try {
  if (-not $TOKEN) {
    Write-Host "✗ SKIP: No token available" -ForegroundColor Yellow
    $results += "SALE: SKIP"
  } else {
    # Calculate correctly:
    # Subtotal: $10.00 (1000 cents)
    # Discount: -$2.00 (200 cents) = 20%
    # Taxable: $8.00 (800 cents)
    # Tax (10%): $0.80 (80 cents)
    # Total: $8.80 (880 cents)
    
    $salePayload = @{
      cartItems = @(
        @{
          productId = "clxfhdgq40003wpcnf0og6hjg"
          quantity = 1
          priceCents = 1000
        }
      )
      subtotalCents = 1000
      discountCents = 200
      taxCents = 80
      totalCents = 880
      paymentMethods = @(
        @{
          method = "CASH"
          amountCents = 880
        }
      )
    } | ConvertTo-Json -Depth 10
    
    $response = Invoke-WebRequest -Uri "$baseUrl/api/sales" `
      -Method POST `
      -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "application/json"
      } `
      -Body $salePayload `
      -TimeoutSec 5 `
      -ErrorAction Stop
    
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.id) {
      Write-Host "✓ PASS: Sale created with correct discount calculation" -ForegroundColor Green
      Write-Host "  • Sale ID: $($data.id)" -ForegroundColor Green
      Write-Host "  • Amount: $($data.totalCents / 100) (calculated: \$8.80)" -ForegroundColor Green
      Write-Host "  • Payment validation: Passed" -ForegroundColor Green
      $results += "SALE: PASS"
    } else {
      Write-Host "✗ FAIL: Sale creation returned no ID" -ForegroundColor Red
      Write-Host "  Response: $($response.Content)" -ForegroundColor Red
      $results += "SALE: FAIL"
    }
  }
} catch {
  $errorMessage = $_.Exception.Message
  $httpCode = if ($_.Exception -is [System.Net.WebException]) {
    $_.Exception.Response.StatusCode.value__
  } else {
    "Unknown"
  }
  
  Write-Host "✗ FAIL: Sale request failed (HTTP $httpCode)" -ForegroundColor Red
  Write-Host "  Error: $errorMessage" -ForegroundColor Red
  $results += "SALE: ERROR"
}

# ============================================================================
# Summary & Visual Testing Instructions
# ============================================================================
Write-Host "`n" -NoNewline
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                        TEST RESULTS                          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$passCount = ($results | Where-Object { $_ -match "PASS" }).Count
$failCount = ($results | Where-Object { $_ -match "FAIL" }).Count
$errorCount = ($results | Where-Object { $_ -match "ERROR" }).Count
$skipCount = ($results | Where-Object { $_ -match "SKIP|WARN" }).Count

Write-Host "`nAPI Tests Results:"
foreach ($result in $results) {
  if ($result -match "PASS") {
    Write-Host "  ✓ $result" -ForegroundColor Green
  } elseif ($result -match "FAIL") {
    Write-Host "  ✗ $result" -ForegroundColor Red
  } elseif ($result -match "ERROR") {
    Write-Host "  ✗ $result" -ForegroundColor Red
  } else {
    Write-Host "  ⊙ $result" -ForegroundColor Yellow
  }
}

Write-Host "`nSummary:"
Write-Host "  Passed: $passCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { [ConsoleColor]::Red } else { [ConsoleColor]::Green })
Write-Host "  Errors: $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { [ConsoleColor]::Red } else { [ConsoleColor]::Green })
Write-Host "  Skipped: $skipCount" -ForegroundColor Yellow

# ============================================================================
# Manual Frontend Testing Instructions
# ============================================================================
Write-Host "`n" -NoNewline
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║              MANUAL FRONTEND VERIFICATION                    ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host "`n📱 Open Browser and Test:" -ForegroundColor Cyan
Write-Host "   Navigate to: http://localhost:5173" -ForegroundColor White

Write-Host "`n✓ TEST 1: Authentication (401 Fix)" -ForegroundColor Yellow
Write-Host "   1. Login with:" -ForegroundColor Gray
Write-Host "      • Email: test@example.com" -ForegroundColor Gray
Write-Host "      • Password: TestPass#123" -ForegroundColor Gray
Write-Host "   2. Check browser console for NO 401 errors" -ForegroundColor Gray
Write-Host "   3. Dashboard/reports should load without authentication errors" -ForegroundColor Gray

Write-Host "`n✓ TEST 2: Payments & Discounts (400 Calculation Fix)" -ForegroundColor Yellow
Write-Host "   1. Navigate to checkout" -ForegroundColor Gray
Write-Host "   2. Add a product (e.g., coffee \$10)" -ForegroundColor Gray
Write-Host "   3. Apply discount (e.g., \$2 off = 20%)" -ForegroundColor Gray
Write-Host "   4. Verify tax calculated on discounted amount:" -ForegroundColor Gray
Write-Host "      Expected: Subtotal \$10 - Discount \$2 = \$8, Tax \$0.80, Total \$8.80" -ForegroundColor Gray
Write-Host "   5. Proceed to payment - should NOT show 400 error" -ForegroundColor Gray

Write-Host "`n✓ TEST 3: Modal Display (CSS Fix)" -ForegroundColor Yellow
Write-Host "   1. Open Payment Modal on checkout" -ForegroundColor Gray
Write-Host "   2. Verify modal fits on screen without zoom-out needed" -ForegroundColor Gray
Write-Host "   3. Content should scroll smoothly if overflowing" -ForegroundColor Gray
Write-Host "   4. Test with different screen sizes" -ForegroundColor Gray

Write-Host "`n✓ TEST 4: Reports (404 Endpoint Fix)" -ForegroundColor Yellow
Write-Host "   1. Navigate to Reports/Dashboard" -ForegroundColor Gray
Write-Host "   2. Daily sales chart should display data" -ForegroundColor Gray
Write-Host "   3. No 404 errors in console" -ForegroundColor Gray

Write-Host "`n" -NoNewline
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Testing Complete! Check console for any remaining errors." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
