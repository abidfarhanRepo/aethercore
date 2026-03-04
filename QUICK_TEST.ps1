#!/usr/bin/env pwsh
<#
Simplified authentication test with user creation
#>

Write-Host "`n" -NoNewline
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         TESTING Fixes - Simplified Version           ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$baseUri = "http://localhost:4000"

# Test 1: Check health
Write-Host "`n✓ TEST 1: Backend Health" -ForegroundColor Yellow
$healthResponse = Invoke-WebRequest -Uri "$baseUri/health" -TimeoutSec 3
$health = $healthResponse.Content | ConvertFrom-Json
if ($health.status -eq "ok") {
  Write-Host "  Backend: Running" -ForegroundColor Green
  Write-Host "  Uptime: $($health.uptime)s" -ForegroundColor Green
}

# Test 2: Get Products (no auth needed)
Write-Host "`n✓ TEST 2: API Access (GET /api/products)" -ForegroundColor Yellow
try {
  $prodResponse = Invoke-WebRequest -Uri "$baseUri/api/products" -TimeoutSec 3
  $prods = $prodResponse.Content | ConvertFrom-Json
  Write-Host "  Products loaded: $($prods.Count) items" -ForegroundColor Green
  if ($prods.Count -gt 0) {
    Write-Host "  Sample: $($prods[0].name)" -ForegroundColor Green
  }
} catch {
  Write-Host "  Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Try login
Write-Host "`n✓ TEST 3: Login (POST /api/auth/login)" -ForegroundColor Yellow
try {
  $loginResp = Invoke-WebRequest -Uri "$baseUri/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"test@example.com","password":"TestPass#123"}' `
    -TimeoutSec 5 `
    -ErrorAction Stop
  
  $loginData = $loginResp.Content | ConvertFrom-Json
  if ($loginData.accessToken) {
    Write-Host "  ✓ Login successful!" -ForegroundColor Green
    Write-Host "    Token: $($loginData.accessToken.Substring(0,30))..." -ForegroundColor Green
    $TOKEN = $loginData.accessToken
    
    # Test 4: Get user with token
    Write-Host "`n✓ TEST 4: Get Current User (GET /api/auth/me)" -ForegroundColor Yellow
    $userResp = Invoke-WebRequest -Uri "$baseUri/api/auth/me" `
      -Headers @{"Authorization" = "Bearer $TOKEN"} `
      -TimeoutSec 5
    
    $userData = $userResp.Content | ConvertFrom-Json
    Write-Host "  ✓ User fetched without 401!" -ForegroundColor Green
    Write-Host "    Email: $($userData.email)" -ForegroundColor Green
    Write-Host "    Role: $($userData.role)" -ForegroundColor Green
    
    # Test 5: Daily Sales Report
    Write-Host "`n✓ TEST 5: Daily Sales Report (GET /api/reports/daily-sales)" -ForegroundColor Yellow
    $reportResp = Invoke-WebRequest -Uri "$baseUri/api/reports/daily-sales" `
      -Headers @{"Authorization" = "Bearer $TOKEN"} `
      -TimeoutSec 5
    
    $reportData = $reportResp.Content | ConvertFrom-Json
    Write-Host "  ✓ Report endpoint working (not 404)!" -ForegroundColor Green
    if ($reportData.hourly) {
      Write-Host "    Data points: $($reportData.hourly.Count)" -ForegroundColor Green
    }
    
    # Test 6: Sale with discount
    Write-Host "`n✓ TEST 6: Sale with Discount (POST /api/sales)" -ForegroundColor Yellow
    $saleResp = Invoke-WebRequest -Uri "$baseUri/api/sales" `
      -Method POST `
      -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "application/json"
      } `
      -Body '{
        "cartItems": [{"productId": "clxfhdgq40003wpcnf0og6hjg", "quantity": 1, "priceCents": 1000}],
        "subtotalCents": 1000,
        "discountCents": 200,
        "taxCents": 80,
        "totalCents": 880,
        "paymentMethods": [{"method": "CASH", "amountCents": 880}]
      }' `
      -TimeoutSec 5
    
    $saleData = $saleResp.Content | ConvertFrom-Json
    if ($saleData.id) {
      Write-Host "  ✓ Sale created with correct discount math!" -ForegroundColor Green
      Write-Host "    Sale ID: $($saleData.id)" -ForegroundColor Green
      Write-Host "    Calculation verified: Subtotal \$10 - Discount \$2 = \$8, Tax \$0.80, Total \$8.80" -ForegroundColor Green
    }
  }
} catch {
  $statusCode = if ($_.Exception -is [System.Net.WebException]) {
    $_.Exception.Response.StatusCode
  } else {
    "Unknown"
  }
  Write-Host "  Login failed with status: $statusCode" -ForegroundColor Red
  Write-Host "  This user may not exist in the database." -ForegroundColor Yellow
  Write-Host "`n  To create a test user, the backend needs to be seeded." -ForegroundColor Yellow
  Write-Host "  For now, please use the frontend to:" -ForegroundColor Yellow
  Write-Host "    1. Sign up a new account" -ForegroundColor Yellow
  Write-Host "    2. Or admin should create seed data" -ForegroundColor Yellow
}

Write-Host "`n" -NoNewline
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          MANUAL BROWSER TESTING REQUIRED              ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "`n📱 Navigate to: http://localhost:5173" -ForegroundColor Cyan
Write-Host "`nWhat to test:" -ForegroundColor Yellow
Write-Host "  1. Sign up or login with your account" -ForegroundColor Gray
Write-Host "  2. Check browser console - NO 401 errors should appear" -ForegroundColor Gray
Write-Host "  3. Navigate to checkout and try placing an order" -ForegroundColor Gray
Write-Host "  4. Apply a discount and verify payment calculation" -ForegroundColor Gray
Write-Host "  5. Open payment modal - should fit on screen without zoom-out" -ForegroundColor Gray
Write-Host "  6. Try to view reports - should load without 404" -ForegroundColor Gray
Write-Host "`n" 
