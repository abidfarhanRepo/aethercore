#!/usr/bin/env pwsh
# Test script for aether POS API endpoints

$ErrorActionPreference = "SilentlyContinue"
$BaseUrl = "http://localhost:4000"

Write-Host "[Test] Testing aether POS API endpoints" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "1. Health Check:" -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Get
Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
Write-Host "  Response: $($response.Content)" -ForegroundColor Gray

# Test 2: Get Products
Write-Host ""
Write-Host "2. Get Products:" -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "$BaseUrl/products" -Method Get
Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
$products = ConvertFrom-Json $response.Content
Write-Host "  Products found: $($products.Count)" -ForegroundColor Gray
if ($products.Count -gt 0) {
  Write-Host "  First product: $($products[0].name) (\$$($products[0].priceCents / 100))" -ForegroundColor Gray
  $productId = $products[0].id
}

# Test 3: Register User
Write-Host ""
Write-Host "3. Register New User:" -ForegroundColor Yellow
$testEmail = "test-$(Get-Random)@aether.dev"
$body = @{email = $testEmail; password = "password123"} | ConvertTo-Json
$response = Invoke-WebRequest -Uri "$BaseUrl/auth/register" -Method Post -Body $body -ContentType "application/json"
Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
$user = ConvertFrom-Json $response.Content
Write-Host "  User ID: $($user.id)" -ForegroundColor Gray
Write-Host "  Email: $($user.email)" -ForegroundColor Gray

# Test 4: Login
Write-Host ""
Write-Host "4. User Login:" -ForegroundColor Yellow
$body = @{email = $testEmail; password = "password123"} | ConvertTo-Json
$response = Invoke-WebRequest -Uri "$BaseUrl/auth/login" -Method Post -Body $body -ContentType "application/json"
Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
$auth = ConvertFrom-Json $response.Content
$accessToken = $auth.accessToken
$refreshToken = $auth.refreshToken
Write-Host "  Access Token received (length: $($accessToken.Length))" -ForegroundColor Gray
Write-Host "  Refresh Token received (length: $($refreshToken.Length))" -ForegroundColor Gray

# Test 5: Get Current User (/auth/me)
Write-Host ""
Write-Host "5. Get Current User (with token):" -ForegroundColor Yellow
$headers = @{Authorization = "Bearer $accessToken"}
$response = Invoke-WebRequest -Uri "$BaseUrl/auth/me" -Method Get -Headers $headers
Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
$currentUser = ConvertFrom-Json $response.Content
Write-Host "  User: $($currentUser.email)" -ForegroundColor Gray
Write-Host "  Role: $($currentUser.role)" -ForegroundColor Gray

# Test 6: Get Inventory
Write-Host ""
Write-Host "6. Get Product Inventory:" -ForegroundColor Yellow
if ($productId) {
  $response = Invoke-WebRequest -Uri "$BaseUrl/inventory/$productId" -Method Get
  Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
  $inventory = ConvertFrom-Json $response.Content
  Write-Host "  Current Stock: $($inventory.quantity) units" -ForegroundColor Gray
} else {
  Write-Host "  Skipped (no product ID)" -ForegroundColor Gray
}

# Test 7: Create Sale (requires auth)
Write-Host ""
Write-Host "7. Create Sale (requires EMPLOYEE role):" -ForegroundColor Yellow
if ($productId) {
  $body = @{
    userId = $user.id
    items = @(
      @{productId = $productId; qty = 1; unitPrice = 1000}
    )
  } | ConvertTo-Json
  $response = Invoke-WebRequest -Uri "$BaseUrl/sales" -Method Post -Body $body -ContentType "application/json" -Headers $headers -ErrorAction Continue
  if ($response.StatusCode -eq 200) {
    Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
    $sale = ConvertFrom-Json $response.Content
    Write-Host "  Sale ID: $($sale.saleId)" -ForegroundColor Gray
    Write-Host "  Total: \$$($sale.totalCents / 100)" -ForegroundColor Gray
  } else {
    Write-Host "✗ Status: $($response.StatusCode)" -ForegroundColor Red
    Write-Host "  Error: $($response.Content)" -ForegroundColor Yellow
  }
} else {
  Write-Host "  Skipped (no product ID)" -ForegroundColor Gray
}

# Test 8: Get Reports - Daily Sales
Write-Host ""
Write-Host "8. Get Reports - Daily Sales:" -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "$BaseUrl/reports/daily-sales" -Method Get -ErrorAction Continue
if ($response.StatusCode -eq 200) {
  Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
  $reports = ConvertFrom-Json $response.Content
  Write-Host "  Report entries: $($reports.Count)" -ForegroundColor Gray
  if ($reports.Count -gt 0) {
    Write-Host "  Latest: $($reports[0].date) - \$$($reports[0].totalCents / 100)" -ForegroundColor Gray
  }
} else {
  Write-Host "✗ Status: $($response.StatusCode)" -ForegroundColor Red
  Write-Host "  Error: Report endpoint status $($response.StatusCode)" -ForegroundColor Yellow
}

# Test 9: Get Reports - Inventory Valuation
Write-Host ""
Write-Host "9. Get Reports - Inventory Valuation:" -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "$BaseUrl/reports/inventory-valuation" -Method Get -ErrorAction Continue
if ($response.StatusCode -eq 200) {
  Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
  $valuations = ConvertFrom-Json $response.Content
  Write-Host "  Product count: $($valuations.Count)" -ForegroundColor Gray
  if ($valuations.Count -gt 0) {
    Write-Host "  Total valuation: \$$($valuations | Measure-Object -Property valueCents -Sum | Select-Object -ExpandProperty Sum | ForEach-Object { $_ / 100 })" -ForegroundColor Gray
  }
} else {
  Write-Host "✗ Status: $($response.StatusCode)" -ForegroundColor Red
  Write-Host "  Error: Report endpoint status $($response.StatusCode)" -ForegroundColor Yellow
}

# Test 10: Get Audit Logs
Write-Host ""
Write-Host "10. Get Audit Logs:" -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "$BaseUrl/audits" -Method Get -ErrorAction Continue
if ($response.StatusCode -eq 200) {
  Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
  $audits = ConvertFrom-Json $response.Content
  Write-Host "  Audit entries: $($audits.Count)" -ForegroundColor Gray
} else {
  Write-Host "✗ Status: $($response.StatusCode)" -ForegroundColor Red
}

# Test 11: Create Purchase Order
Write-Host ""
Write-Host "11. Create Purchase Order:" -ForegroundColor Yellow
if ($productId) {
  $body = @{
    userId = $user.id
    items = @(
      @{productId = $productId; qty = 5; unitPrice = 600}
    )
  } | ConvertTo-Json
  $response = Invoke-WebRequest -Uri "$BaseUrl/purchases" -Method Post -Body $body -ContentType "application/json" -ErrorAction Continue
  if ($response.StatusCode -eq 200) {
    Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
    $po = ConvertFrom-Json $response.Content
    Write-Host "  PO ID: $($po.purchaseOrderId)" -ForegroundColor Gray
    Write-Host "  Total: \$$($po.totalCents / 100)" -ForegroundColor Gray
  } else {
    Write-Host "✗ Status: $($response.StatusCode)" -ForegroundColor Red
  }
} else {
  Write-Host "  Skipped (no product ID)" -ForegroundColor Gray
}

# Test 12: Admin Users (should fail - not implemented)
Write-Host ""
Write-Host "12. Get Admin Users (expected to fail):" -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "$BaseUrl/admin/users" -Method Get -Headers $headers -ErrorAction Continue
if ($response.StatusCode -eq 404 -or $response.StatusCode -eq 405) {
  Write-Host "✗ Status: $($response.StatusCode)" -ForegroundColor Yellow
  Write-Host "  Expected: Admin endpoint not implemented" -ForegroundColor Gray
} elseif ($response.StatusCode -eq 200) {
  Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
  $users = ConvertFrom-Json $response.Content
  Write-Host "  Users: $($users.Count)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=" * 60
Write-Host "Test Complete" -ForegroundColor Cyan
