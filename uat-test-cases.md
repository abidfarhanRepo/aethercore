# Aether POS - User Acceptance Testing (UAT) Procedures

## Overview
User Acceptance Testing validates that Aether POS meets business requirements and is ready for production use. Conducted by business stakeholders (not development team).

## UAT Participants
- **Product Owner**: Business representative, approves functionality
- **Store Manager**: End-user representative, validates workflow
- **System Administrator**: Technical owner, verifies data integrity
- **QA Lead**: Facilitator, documents results, tracks issues

## UAT Scope

### In Scope
- User workflow validation
- Data accuracy verification
- Report correctness
- Business logic correctness
- Integration with business processes
- System usability
- Data migration validation

### Out of Scope
- Code quality review
- Technical performance tuning
- Bug fixes (only critical blocking issues)
- New feature development

## UAT Environment Setup

### Access Credentials
```
Admin User:
  Email: admin@uat.test.com
  Password: UAT_Admin_123!

Manager User:
  Email: manager@uat.test.com
  Password: UAT_Manager_123!

Cashier User 1:
  Email: cashier1@uat.test.com
  Password: UAT_Cashier_123!

Cashier User 2:
  Email: cashier2@uat.test.com
  Password: UAT_Cashier_123!

Test Store: "UAT Test Store"
```

### Test Data
- 10 sample products ($9.99 - $999.99)
- 100 sample inventory items
- 50 sample customer records
- 20 historical sales (for report testing)
- 5 test locations (if multi-store)

### Environment Status
- [ ] Database loaded with test data
- [ ] API accessible at https://uat-api.local:4000
- [ ] Frontend accessible at https://uat.local:5173
- [ ] Email service configured (test only)
- [ ] Payment gateway in sandbox mode
- [ ] All notifications enabled

## UAT Test Cases (50+)

### Category 1: User Management (5 tests)

**UAT-001: Register New Cashier**
- **Preconditions**: Admin logged in
- **Steps**:
  1. Go to Settings → Users
  2. Click "Add User"
  3. Enter: Email "cashier3@test.com", Name "John Cashier", Role "Cashier"
  4. Click "Save"
- **Expected Results**:
  - User created successfully
  - Welcome email sent
  - User appears in user list
  - User can login next day
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-002: Update User Permissions**
- **Preconditions**: Admin logged in, cashier1 exists
- **Steps**:
  1. Go to Settings → Users
  2. Find "cashier1"
  3. Click "Edit"
  4. Change role from "Cashier" to "Manager"
  5. Click "Save"
- **Expected Results**:
  - Role updated
  - User can now access manager functions
  - Permission change effective immediately
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-003: Disable User Account**
- **Preconditions**: Admin logged in
- **Steps**:
  1. Go to Settings → Users
  2. Find a test user
  3. Click "Disable"
  4. Confirm
- **Expected Results**:
  - User marked as inactive
  - User cannot login
  - User listed as disabled
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-004: Password Reset**
- **Preconditions**: Cashier user exists
- **Steps**:
  1. Go to home page (before login)
  2. Click "Forgot Password?"
  3. Enter email: "cashier1@test.com"
  4. Click "Send Reset Link"
  5. Check email for reset link
  6. Click reset link in email
  7. Enter new password
  8. Click "Reset"
  9. Login with new password
- **Expected Results**:
  - Reset email received within 1 minute
  - Link expires after 2 hours
  - Link only works once
  - New password works
  - Old password doesn't work
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-005: Two-Factor Authentication (if implement)**
- **Preconditions**: User created
- **Steps**:
  1. Login as user
  2. Go to Settings → Security
  3. Enable 2FA
  4. Scan QR code with authenticator
  5. Verify code works
  6. Logout, login again, verify 2FA prompt
- **Expected Results**:
  - 2FA code required on login
  - Backup codes generated
  - Can disable 2FA
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

### Category 2: POS & Sales (15 tests)

**UAT-006: Complete Sale - Single Item**
- **Preconditions**: Cashier logged in, products available
- **Steps**:
  1. Click "Start Sale"
  2. Click product "Laptop" ($999.99)
  3. Quantity shows "1"
  4. Click "Checkout"
  5. Select "Cash" payment
  6. Click "Process Payment"
  7. Verify receipt shown
  8. Click "Print" or "Done"
- **Expected Results**:
  - Sale completed
  - Receipt shows: Laptop, Price, Tax, Total
  - Inventory reduced by 1
  - Sale recorded in Sales list
  - No errors in system
- **Status**: [ ] Pass / [ ] Fail / [ ] Block
- **Notes**: ________________

**UAT-007: Apply Percentage Discount**
- **Preconditions**: Cashier logged in, Laptop in cart ($999.99)
- **Steps**:
  1. Click "Add Discount"
  2. Select "Percentage"
  3. Enter "10"
  4. Click "Apply"
  5. Total updates to $899.99 (with tax)
- **Expected Results**:
  - $100 discount applied
  - Total recalculated correctly
  - Discount shown on receipt
  - Math verified
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-008: Apply Fixed Amount Discount**
- **Preconditions**: Cashier logged in, Product in cart ($100)
- **Steps**:
  1. Click "Add Discount"
  2. Select "Fixed Amount"
  3. Enter "$10"
  4. Click "Apply"
  5. Total updates to $90 (with tax)
- **Expected Results**:
  - $10 discount applied
  - Receipt shows discount
  - Tax calculated on discounted amount
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-009: Apply Bulk/Volume Discount**
- **Preconditions**: Cashier logged in, Product supports bulk discount
- **Steps**:
  1. Add 5 "Pens" (normally $1 each = $5)
  2. Bulk discount automatically applies (5+ items = 20% off)
  3. Total shows $4 (20% discount)
- **Expected Results**:
  - Bulk discount auto-applied
  - Correct discount percentage
  - Total calculated correctly
  - Discount line item shows
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-010: Multiple Discounts**
- **Preconditions**: Cashier logged in, $100 item in cart
- **Steps**:
  1. Apply 5% percentage discount ($5)
  2. Apply $10 fixed discount
  3. Total should be $100 - $5 - $10 = $85
- **Expected Results**:
  - Both discounts applied and shown
  - Math correct
  - Receipt lists both discounts
  - No double-discounting
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-011: Tax Calculation**
- **Preconditions**: Cashier logged in, Laptop ($999.99) in cart
- **Steps**:
  1. Review tax rate (should be 10%)
  2. Expected tax: $100
  3. Expected total: $1,099.99
  4. Process payment
- **Expected Results**:
  - Tax calculated correctly
  - Based on correct rate for location
  - Shown as line item on receipt
  - Total is accurate
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-012: Tender Options - Cash**
- **Preconditions**: Sale total is $99.99
- **Steps**:
  1. Select payment method "Cash"
  2. Enter amount "100"
  3. System calculates change: $0.01
  4. Click "Confirm"
  5. Receipt prints
- **Expected Results**:
  - Change calculated correctly
  - Receipt shows cash payment
  - Sale marked as completed
  - No errors
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-013: Tender Options - Card (Simulated)**
- **Preconditions**: Sale total is $99.99
- **Steps**:
  1. Select payment method "Card"
  2. Click "Process Payment"
  3. Card gateway simulator loads
  4. Enter test card: 4242424242424242
  5. Future date, any CVC
  6. Click "Pay"
- **Expected Results**:
  - Payment processed
  - Receipt shows card payment
  - Last 4 digits shown (****4242)
  - Sale marked complete
  - Confirmation email sent
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-014: Refund - Full**
- **Preconditions**: Sale exists (e.g., $99.99 for Laptop)
- **Steps**:
  1. Go to "Sales"
  2. Find today's sale
  3. Click on sale
  4. Click "Create Refund"
  5. Confirm full refund
  6. Click "Process"
  7. Verify receipt shows refund
- **Expected Results**:
  - Full $99.99 refunded
  - Inventory restored (Laptop quantity +1)
  - Refund shown in transaction history
  - Customer can see refund
  - Email confirmation sent
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-015: Refund - Partial**
- **Preconditions**: Sale exists with $99.99 Laptop in cart
- **Steps**:
  1. Go to "Sales"
  2. Find sale
  3. Click "Create Refund"
  4. Change amount to $50
  5. Click "Process"
- **Expected Results**:
  - Only $50 refunded
  - One Laptop item removed from inventory
  - Refund recorded
  - Customer sees $50 credit
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-016: Multiple Items in Sale**
- **Preconditions**: Cashier logged in
- **Steps**:
  1. Add Laptop ($999.99)
  2. Add Mouse ($29.99)
  3. Add Keyboard ($79.99)
  4. Subtotal shows $1,109.97
  5. Add 10% discount ($110.99)
  6. Tax 10% on $998.98 = $99.90
  7. Total = $1,098.88
  8. Process payment
- **Expected Results**:
  - All items added correctly
  - Discount applies to subtotal
  - Tax calculated correctly
  - Receipt shows all items and calculations
  - Inventory updated for all items
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-017: Void Transaction**
- **Preconditions**: Sale in progress (items added, before checkout)
- **Steps**:
  1. Click "Void Sale"
  2. Confirm void
  3. Return to empty POS
- **Expected Results**:
  - Sale cancelled
  - Inventory unchanged
  - No transaction recorded
  - Clear confirmation message
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-018: Print Receipt**
- **Preconditions**: Sale completed, receipt displayed
- **Steps**:
  1. Click "Print"
  2. Select printer "Receipt Printer"
  3. Verify print job sent
  4. Check for physical receipt
- **Expected Results**:
  - Receipt prints correctly
  - All lines visible
  - Logo prints
  - No truncated text
  - Paper feeds properly
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-019: Email Receipt**
- **Preconditions**: Sale completed, receipt displayed
- **Steps**:
  1. Click "Email Receipt"
  2. Enter email: "customer@test.com"
  3. Click "Send"
  4. Check email within 1 minute
- **Expected Results**:
  - Email received
  - Receipt attached as PDF
  - Email readable
  - Logo and formatting preserved
  - Can print from email
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-020: No Sale Button / Tender Tracking**
- **Preconditions**: Cashier logged in
- **Steps**:
  1. Click "No Sale" button (register open for cash drawer management)
  2. Confirm
  3. Earnings report should not count this
- **Expected Results**:
  - Cash drawer opens
  - No sale recorded
  - Not shown in sales report
  - Documented for audit trail
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

### Category 3: Inventory Management (8 tests)

**UAT-021: View Inventory by Location**
- **Preconditions**: Admin/Manager logged in, multiple locations exist
- **Steps**:
  1. Go to Inventory
  2. Select location "Main Store"
  3. View stock levels
  4. Switch to location "Warehouse"
  5. Stock levels change
- **Expected Results**:
  - Each location has separate inventory
  - Quantities accurate
  - Easy to switch locations
  - Stock levels match physical count
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-022: Stock Adjustment**
- **Preconditions**: Laptop has 10 units in inventory
- **Steps**:
  1. Go to Inventory
  2. Find "Laptop"
  3. Click "Adjust Stock"
  4. Current: 10, Enter new: 8
  5. Reason: "Physical count discrepancy"
  6. Click "Save"
- **Expected Results**:
  - Stock updated to 8
  - Adjustment logged with reason
  - Adjustment shown in inventory history
  - Timestamp recorded
  - User documented
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-023: Stock Transfer Between Locations**
- **Preconditions**: Main Store has 10 Laptops, Warehouse has 0
- **Steps**:
  1. Go to Inventory → Transfers
  2. From: "Main Store", To: "Warehouse"
  3. Product: "Laptop", Quantity: 5
  4. Click "Transfer"
- **Expected Results**:
  - Main Store: 5 Laptops
  - Warehouse: 5 Laptops
  - Transfer recorded and dated
  - Inventory history shows transfer
  - Both locations updated immediately
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-024: Low Stock Alert**
- **Preconditions**: Pens have 5 items, low stock threshold is 10
- **Steps**:
  1. Go to Inventory
  2. Look for "Pens" - should show warning icon
  3. Click product
  4. Alert shows: "Low Stock - 5 remaining"
- **Expected Results**:
  - Alert visible
  - Clear message
  - Suggests reorder
  - Doesn't block sales but warns
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-025: Reorder Point Configuration**
- **Preconditions**: Admin logged in
- **Steps**:
  1. Go to Inventory Settings
  2. Set reorder point for Pens: 20
  3. Current stock: 5
  4. Alert should auto-generate
- **Expected Results**:
  - Reorder point saved
  - Alert generated
  - Alert shown in dashboard
  - Reorder email sent to manager
- **Status**: [ ] Pass / / Fail / [ ] Block

**UAT-026: Inventory History/Transactions**
- **Preconditions**: Inventory adjustments made, sales completed
- **Steps**:
  1. Go to Inventory → History
  2. View all transactions (sales, adjustments, transfers)
  3. Filter by product "Laptop"
  4. Filter by date range
  5. Export to CSV
- **Expected Results**:
  - All events shown chronologically
  - Filters work
  - CSV exports correctly
  - Can open in Excel
  - Can identify every stock change
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-027: Barcode Scan**
- **Preconditions**: Barcode scanner connected, Laptop barcode ready
- **Steps**:
  1. Go to Inventory
  2. Click "Scan"
  3. Scan Laptop barcode
  4. Product auto-populated
- **Expected Results**:
  - Product found
  - Stock quantity shows
  - Quantity adjustment works
  - Multiple scans possible quickly
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-028: Inventory Import**
- **Preconditions**: CSV file with inventory data prepared
- **Steps**:
  1. Go to Inventory → Import
  2. Upload CSV file with new products
  3. Preview shows 100 products,
  4. Click "Import"
  5. Processing completes
- **Expected Results**:
  - Products imported
  - Stock quantities set
  - No duplicates created
  - Import log shows results
  - All products now in system
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

### Category 4: Reporting & Analytics (10 tests)

**UAT-029: Daily Sales Report**
- **Preconditions**: 5+ sales completed today
- **Steps**:
  1. Go to Reports
  2. Select "Daily Sales"
  3. Click "Generate"
  4. Report shows today's date
  5. Lists all 5+ sales
- **Expected Results**:
  - All sales listed
  - Totals accurate
  - Product breakdown shown
  - Data matches actual sales
  - Report generates <5 seconds
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-030: Revenue Calculation**
- **Preconditions**: 3 sales completed:
  - Sale 1: $100
  - Sale 2: $50
  - Sale 3: $25
  - Total: $175 (before tax)
- **Steps**:
  1. Generate Daily Sales Report
  2. Check revenue total
- **Expected Results**:
  - Revenue shows $175
  - Subtotal, tax, and total breakdown
  - Matches sum of all sales
  - No discrepancies
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-031: Product Report - Top Sellers**
- **Preconditions**: Multiple sales with various products
- **Steps**:
  1. Go to Reports → Products
  2. Select "Top Sellers"
  3. Choose date range (past 7 days)
  4. Generate report
- **Expected Results**:
  - Products ranked by quantity sold
  - Quantities correct
  - Revenues accurate
  - Top seller listed first
  - Can export
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-032: Profit Margin Calculation**
- **Preconditions**: Products have cost prices, sales recorded
  - Laptop: Cost $800, Sell $999.99, Margin 18%
- **Steps**:
  1. Generate Product Report
  2. Check profit margin for Laptop
- **Expected Results**:
  - Margin shows ~18%
  - Accurate calculation
  - Shown per product
  - Shown in total
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-033: Report Filter - Date Range**
- **Preconditions**: Sales exist for past 30 days
- **Steps**:
  1. Go to Reports
  2. Select "Daily Sales"
  3. Filter by date: March 1 - March 4
  4. Click "Apply"
- **Expected Results**:
  - Report shows only 4 days of data
  - 5 weeks of data excluded
  - Totals recalculated
  - Filter applied correctly
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-034: Report Filter - Product/Category**
- **Preconditions**: Sales of laptops, mou, keyboards exist
- **Steps**:
  1. Go to Reports
  2. Filter by Category: "Electronics"
  3. Click "Apply"
- **Expected Results**:
  - Only electronics sales shown
  - Laptops, mice, keyboards shown
  - Office supplies filtered out
  - Totals updated
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-035: Report Filter - Store Location**
- **Preconditions**: Multi-location setup with sales at each
- **Steps**:
  1. Go to Reports
  2. Filter by Location: "Main Store"
  3. Click "Apply"
- **Expected Results**:
  - Only Main Store sales shown
  - Warehouse sales excluded
  - Totals match only Main Store
  - Easy to compare locations
- **Status**: [ ] Pass / / Fail / [ ] Block

**UAT-036: Export Report - CSV**
- **Preconditions**: Daily Sales Report generated
- **Steps**:
  1. Click "Export CSV"
  2. File downloads as "Daily_Sales_2024_03_04.csv"
  3. Open in Excel
  4. Check formatting and data
- **Expected Results**:
  - File downloads
  - Filename includes date
  - Excel opens correctly
  - All data present
  - Properly formatted columns
  - Can sort/filter in Excel
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-037: Export Report - PDF**
- **Preconditions**: Daily Sales Report generated
- **Steps**:
  1. Click "Export PDF"
  2. PDF downloads
  3. Open in PDF reader
  4. Check formatting and logo
- **Expected Results**:
  - PDF downloads
  - Clean formatting
  - Logo displayed
  - All data readable
  - Can print from PDF reader
  - Professional appearance
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-038: Schedule Report Email**
- **Preconditions**: Admin logged in
- **Steps**:
  1. Go to Reports
  2. Click "Schedule"
  3. Select "Daily Sales Report"
  4. Recipient: manager@test.com
  5. Time: 8:00 AM daily
  6. Format: PDF
  7. Click "Save"
- **Expected Results**:
  - Schedule saved
  - Report emails at 8:00 AM
  - Manager receives daily email
  - Correct format (PDF)
  - Can be scheduled per user role
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

### Category 5: Offline Functionality (6 tests)

**UAT-039: Work Offline - Create Sales**
- **Preconditions**: Offline mode enabled, network disabled
- **Steps**:
  1. Close internet/disconnect network
  2. POS still accessible
  3. Add items to cart
  4. Apply discount
  5. Process payment
  6. Receipt shows "Synced Offline"
- **Expected Results**:
  - POS works without network
  - Sale created locally
  - Receipt generated
  - System indicates offline status
  - No loss of functionality
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-040: Offline Queue**
- **Preconditions**: 5 sales created offline
- **Steps**:
  1. Go to Settings
  2. View "Pending Sync" queue
  3. Shows 5 pending sales
  4. Reconnect network
  5. System auto-syncs
  6. Queue empties
- **Expected Results**:
  - Queue visible
  - Shows all pending sales
  - Auto-syncs when online
  - Status updates to "Synced"
  - No data loss
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-041: Conflict Resolution**
- **Preconditions**: Offline: price changes, online: inventory changes
- **Steps**:
  1. Sale created offline ($50)
  2. Network reconnects
  3. Item now costs $60 online
  4. Conflict detection triggers
  5. Manual review required
- **Expected Results**:
  - Conflict detected
  - Alert shown
  - Can review both versions
  - Can choose to use original price
  - Sale approved and synced
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-042: Offline Inventory Lock**
- **Preconditions**: Laptop has 10 units, 2 cashiers online, 1 offline
- **Steps**:
  1. Online: Sale 1 sells 5 Laptops (5 left)
  2. Offline: Sale 2 tries to sell 10 Laptops
  3. Offline shows: 10 available (last sync)
  4. Offline completes sale
  5. Network reconnects
  6. Conflict: Only 5 available, but 10 sold
- **Expected Results**:
  - System detects oversell
  - Alert shown: "Only 5 Laptops available"
  - Override options:
    - Reject offline sale
    - Accept and create backorder
    - Partial credit note
  - Inventory consistency maintained
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-043: Offline Persistence**
- **Preconditions**: POS in offline mode with pending sales
- **Steps**:
  1. Store loses power
  2. iPad/system restarts
  3. POS reopens
  4. Offline queue still present
- **Expected Results**:
  - Data persisted
  - All pending sales still in queue
  - No data loss
  - System auto-syncs when network back
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-044: Offline Notification**
- **Preconditions**: POS in offline mode
- **Steps**:
  1. Clear indicator shows "OFFLINE"
  2. Color change (red or warning)
  3. Cashier can't miss the status
  4. Network restored
  5. Indicator changes to "ONLINE"
- **Expected Results**:
  - Status always visible
  - Cashier awareness high
  - Clear visual indicator
  - Updates when status changes
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

### Category 6: Compliance & Security (5 tests)

**UAT-045: Password Security Requirements**
- **Preconditions**: Creating new user
- **Steps**:
  1. Try password: "abc" (too weak)
  2. System rejects: "Min 8 chars"
  3. Try: "Password" (no number)
  4. System rejects: "Must include number"
  5. Try: "Pass1234" (no special char)
  6. System rejects: "Must include special char"
  7. Try: "Pass@1234" (good)
  8. System accepts
- **Expected Results**:
  - Requirements enforced
  - Clear error messages
  - Prevents weak passwords
  - Secure passwords mandatory
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-046: Account Lockout**
- **Preconditions**: User account exists
- **Steps**:
  1. Failed login attempt 1 (wrong password)
  2. Failed login attempt 2
  3. Failed login attempt 3
  4. Failed login attempt 4
  5. Failed login attempt 5
  6. Try login again immediately
- **Expected Results**:
  - Account locked after 5 failures
  - Clear message: "Account locked, try again in 30 min"
  - 6th attempt blocked
  - Admin can unlock manually
  - Auto-unlock after 30 minutes
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-047: User Activity Audit Trail**
- **Preconditions**: Admin logged in, multiple users active
- **Steps**:
  1. Go to Settings → Audit Log
  2. View all user actions (login, sales, voids, refunds)
  3. Filter by user "cashier1"
  4. Filter by action type "Refund"
  5. Filter by date
- **Expected Results**:
  - All actions logged
  - User, action, timestamp captured
  - Easy to find specific events
  - Can export audit log
  - Immutable (can't delete)
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-048: Cash Drawer Reconciliation**
- **Preconditions**: Cashier has processed sales with various payment methods
- **Steps**:
  1. End of shift, click "Close Drawer"
  2. System calculates expected cash
  3. Cashier counts physical cash
  4. Enters actual count: $99.50
  5. Expected was $100
  6. Variance: -$0.50
- **Expected Results**:
  - Variance calculated
  - Report shows expected vs. actual
  - Signed off by manager
  - Documented for bank deposit
  - Variance tracked over time
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-049: PCI DSS Compliance (Payment)**
- **Preconditions**: Sales with multiple payment methods
- **Steps**:
  1. Check payment records
  2. Full credit card numbers NOT stored
  3. Only last 4 digits shown (****1234)
  4. CVV never logged
  5. Expiry not shown (for security)
- **Expected Results**:
  - PCI compliant
  - Card data not visible
  - Tokenized payments only
  - Receipts show only last 4 digits
  - Reports don't expose card data
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

### Category 7: Data Integrity (5 tests)

**UAT-050: Inventory Accuracy**
- **Preconditions**: Physical count completed, system inventory known
- **Steps**:
  1. Count 5 random products
  2. Laptop: Physical 9, System 9 ✓
  3. Mouse: Physical 48, System 50 ✗
  4. Keyboard: Physical 19, System 19 ✓
  5. Adjust system to match physical
- **Expected Results**:
  - Discrepancies identified
  - Adjustments made
  - System equals physical count
  - Investigation done for variance
- **Status**: [ ] Pass / / Fail / [ ] Block

**UAT-051: Sales Data Integrity**
- **Preconditions**: 30 days of sales data exists
- **Steps**:
  1. Run report: "Total Revenue - 30 Days"
  2. Manually sum top 10 sales
  3. Export all sales to CSV
  4. Verify exported data matches
  5. Database backup created
  6. Restore from backup
  7. Verify data identical
- **Expected Results**:
  - All sales recorded
  - No missing transactions
  - Data exportable
  - Backups work
  - Restore returns exact copy
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-052: Duplicate Transaction Prevention**
- **Preconditions**: POS network interruption during payment
- **Steps**:
  1. Processor payment, network cuts
  2. Customer sees unclear result
  3. Reconnects, retries payment
  4. System recognizes duplicate attempt
  5. Uses original transaction
- **Expected Results**:
  - Customer only charged once
  - System prevents duplicates
  - Idempotency maintained
  - Receipt shows original transaction
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-053: Timezone Consistency**
- **Preconditions**: Multi-location stores in different timezones
- **Steps**:
  1. New York location creates sale at 1 PM EST
  2. Los Angeles location creates sale at 1 PM PST
  3. Check timestamps in system
  4. Both show in same timezone (UTC)
  5. Reports correctly convert back
- **Expected Results**:
  - All times stored in UTC
  - Timezone conversions correct
  - Reports show local time
  - No double-counting across timezones
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

**UAT-054: Database Consistency Check**
- **Preconditions**: Weeks of live data
- **Steps**:
  1. Admin runs "Integrity Check"
  2. System verifies:
     - All sales have line items
     - Inventory counts make sense
     - No orphaned records
     - Foreign key constraints valid
  3. Tool reports results
- **Expected Results**:
  - No integrity errors
  - All relationships valid
  - Data clean and usable
  - Report shows clean bill of health
- **Status**: [ ] Pass / [ ] Fail / [ ] Block

## UAT Test Execution

### Test Execution Timeline
- **Week 1**: System setup, user training, initial testing
- **Week 2**: Core workflow testing (UAT-006 through UAT-025)
- **Week 3**: Reporting and advanced features (UAT-026 through UAT-038)
- **Week 4**: Offline, compliance, data integrity (UAT-039 through UAT-054)

### Daily Test Execution
```
Morning (9 AM):
- Review tests to execute
- Prepare test data
- Test environment check

Midday (12 PM):
- Execute assigned tests
- Document results
- Note any issues

Afternoon (3 PM):
- Review results
- Triage issues
- Plan next day tests
```

### Test Result Documentation

**Test Result Template**:
```
Test ID: UAT-XXX
Test Name: [Name]
Date: [Date]
Executed By: [Name]
Environment: UAT
Browser: [Chrome, Firefox, Safari]
OS: [Windows, macOS, iOS]

Result: [ ] PASS / [ ] FAIL / [ ] BLOCK

If FAIL or BLOCK:
  Issue: [Description]
  Severity: [ ] Critical [ ] High [ ] Medium [ ] Low
  Steps to Reproduce: [Steps]
  Defect ID: [AUTO-XXX]
  Assigned to: [Developer]

Comments: [Any notes]
```

## UAT Defect Tracking

### Severity Levels
- **Critical**: System down, data loss, security issue - BLOCKS RELEASE
- **High**: Feature broken, calculation wrong - MUST FIX
- **Medium**: UI issue, minor flow problem - SHOULD FIX
- **Low**: Text typo, minor visual issue - CAN DEFER

### Example Defects

**Defect AUTO-001: Tax not calculating on discounted amount**
- Severity: HIGH
- Status: Open
- Description: When 10% discount applied, tax should be on discounted amount ($90), but calculates on original ($100)
- Impact: Incorrect sales totals
- Fix: Recalculate tax after discount applied

**Defect AUTO-002: Report export to CSV shows wrong date format**
- Severity: LOW
- Status: Open
- Description: CSV export shows dates as "2024-03-04" but should be "03/04/2024"
- Impact: Confusing for users
- Fix: Format dates in export

## UAT Sign-Off

### Product Owner Sign-Off
```
I have reviewed the UAT results and confirm:

✅ All critical workflows function correctly
✅ Data accuracy verified
✅ System meets business requirements
✅ Acceptable for production use
✅ Defects not blocking release (if any)

Name: _________________
Title: __________________
Date: __________________
Signature: ______________
```

### Store Manager Sign-Off
```
As the primary end-user, I confirm:

✅ System is easy to use
✅ Workflow matches our process
✅ All features we need are present
✅ Staff can operate without training
✅ Ready for store deployment

Name: _________________
Title: __________________
Date: __________________
Signature: ______________
```

### Final Approval
```
UAT Execution: COMPLETE
Critical Test Cases: 50+ executed
Pass Rate: ___%
Critical Defects: 0
High Defects: 0
Medium Defects: __ (acceptable)
Low Defects: __ (deferred)

Status: [ ] APPROVED FOR PRODUCTION
         [ ] APPROVED WITH CONDITIONS
         [ ] NOT APPROVED - NEEDS FIXES

Release Decision: GO / NO-GO

QA Lead: _________________
Date: ___________________
```

## Post-UAT

### Defect Fix Verification
- [ ] All critical defects fixed
- [ ] All high defects fixed
- [ ] Fixes verified in UAT environment
- [ ] Regression testing completed

### Final Production Checklist
- [ ] All 50+ UAT test cases reviewed
- [ ] Pass rate ≥95%
- [ ] No critical/high defects
- [ ] All stakeholders signed off
- [ ] Documentation complete
- [ ] Support trained
- [ ] Rollback procedure tested
- [ ] Go-live scheduled

### Stakeholder Communication
- UAT results shared
- Issues addressed
- Timeline to next milestone
- Post-launch support plan
- Contact information for issues
