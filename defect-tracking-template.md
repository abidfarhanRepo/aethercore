# Aether POS - Defect Tracking Template

## Defect Report Template

Use this template for every defect found during testing. Store in: `defects/AUTO-XXX.md`

### Defect ID: AUTO-###
**Date Reported**: YYYY-MM-DD
**Reported By**: [QA Engineer Name]
**Status**: [New / Open / In Progress / Resolved / Verified / Closed]

---

## Summary
**Title**: [Brief one-line description]

**Severity**: 
- [ ] **Critical** - System down, data loss, security vulnerability
- [ ] **High** - Feature broken, wrong calculation, significant issue
- [ ] **Medium** - UI bug, minor feature issue, workaround available
- [ ] **Low** - Text typo, minor visual issue, enhancement

**Priority**:
- [ ] **Immediate** - Must fix before release (Critical severity)
- [ ] **High** - Should fix before release (High severity)
- [ ] **Normal** - Prefer to fix  (Medium severity)
- [ ] **Low** - Can defer to next release (Low severity)

**Component**:
- [ ] Frontend
- [ ] Backend
- [ ] Database
- [ ] API
- [ ] Integration
- [ ] Other: _________

---

##Description

### Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3
4. Final step

**How often can you reproduce?**
- [ ] Always
- [ ] Usually (75%)
- [ ] Sometimes (50%)
- [ ] Rarely (25%)
- [ ] Once (couldn't reproduce)

### Expected Behavior
What should happen:
- Item 1
- Item 2
- Etc.

### Actual Behavior
What really happens:
- Observed result 1
- Observed result 2
- Etc.

### Difference
Explain the gap between expected and actual:

---

## Environment

**Browser**: [ ] Chrome [ ] Firefox [ ] Safari [ ] Edge [ ] Other: _____
**Browser Version**: _____

**Operating System**: [ ] Windows [ ] macOS [ ] Linux [ ] iOS [ ] Android
**OS Version**: _____

**Test Environment**: [ ] Dev [ ] QA [ ] Staging [ ] Production
**URL**: _____

**Test Data Used**: [Provide specific user IDs, product IDs, etc. to reproduce]
- User: ____
- Product: ____
- Location: ____

**Database**: [If applicable]
- Environment: ____
- Data loaded: ____

---

## Attachments

### Screenshots
- [ ] Before (expected behavior)
- [ ] After (actual behavior)
- [ ] Error message screenshot
- [ ] Browser console errors

### Logs
- [ ] Application log
- [ ] Server error log
- [ ] Browser developer tools log
- [ ] Network requests log

**Files**: [List any attached files]
- File 1: ____
- File 2: ____

---

## Impact Analysis

**Affected Workflows**:
- [ ] User authentication
- [ ] POS checkout
- [ ] Inventory management
- [ ] Reporting
- [ ] Refunds
- [ ] Offline sync
- [ ] Other: _____

**Number of Users Affected**:
- [ ] 1 user
- [ ] 1 store
- [ ] Multiple stores
- [ ] All users
- [ ] Unknown

**Data Loss**:
- [ ] No data loss
- [ ] Potential data loss
- [ ] Confirmed data loss
- Type of data: ____

**Business Impact**:
- Describe impact on business, customer, operations
- Financial impact (if applicable)
- Regulatory/compliance impact (if applicable)

---

## Root Cause Analysis

Started: [Developer Name], [Date]

### Initial Hypothesis
Why might this be happening?:
- Cause 1
- Cause 2
- Cause 3

### Investigation Results
What did you find?:

### Root Cause
The actual cause is:
- [Specific code, configuration, or process]
- [Link to specific file/line if code-related]

---

## Resolution

### Fix Applied
**Branch**: feature/fix-AUTO-###
**Commit**: [GitHub commit hash]

What was changed:
- Change 1
- Change 2
- Files modified:
  - filename.ts
  - filename.tsx

### Code Review
- Reviewed by: [Name]
- Approved: [ ] Yes [ ] No
- Comments: [Any reviewer notes]

### Testing Done
- [ ] Unit test written to prevent regression
- [ ] Integration test updated
- [ ] Manual verification completed
- [ ] Performance impact assessed
- [ ] No new issues introduced

### Performance Impact
- [ ] No impact
- [ ] Minor improvement
- [ ] Minor degradation
- [ ] Significant change (describe)

---

## Verification

**Verified By**: [QA Engineer Name]
**Verification Date**: YYYY-MM-DD

### Verification Steps
1. Reproduced defect with original code
2. Applied fix
3. Verified fix resolves issue
4. Verified no regression in related features
5. Verified on multiple browsers/devices

### Verification Result
- [ ] **PASS** - Defect fixed, ready to close
- [ ] **FAIL** - Issue persists, needs more work
- [ ] **CONDITIONAL** - Fixed but has caveats

**Notes**: [Any otes about verification]

---

## Related Issues

### Linked Defects
- Similar issue: AUTO-### [Brief description]
- Related issue: AUTO-### [Brief description]

### Feature Requests
- Feature request: FR-### [Brief description]

### Commits/PRs
- Git PR: #123
- Commit: abc1234

---

## Closure

**Closed By**: [Name]
**Closed Date**: YYYY-MM-DD
**Resolution**: [Type of resolution]

- [ ] **Fixed** - Issue resolved via code/configuration change
- [ ] **Won't Fix** - Intentional behavior, not a bug
- [ ] **Duplicate** - Same as issue AUTO-###
- [ ] **Cannot Reproduce** - Insufficient information
- [ ] **Deferred** - Pushed to next release
- [ ] **Invalid** - Not a defect

**Closure Comments**: [Final notes]

---

## Lessons Learned

**What did we learn?**
- Lesson 1
- Lesson 2

**Prevention**:
What can we do to prevent this in the future?
- Prevention step 1
- Prevention step 2

**Improvement**:
Where can we improve testing, processes, or code?
- Improvement 1
- Improvement 2

---

## Follow-up Actions

**Action Items**:
- [ ] Add regression test (Unit test, Integration test, E2E test)
- [ ] Update documentation
- [ ] Update coding standards/guidelines
- [ ] Team training on this area
- [ ] Code review improvements
- [ ] Process improvements

**Assigned To**:
- [Name]: [Action] - Due: [Date]
- [Name]: [Action] - Due: [Date]

---

## History

| Date | Author | Change |
|------|--------|--------|
| YYYY-MM-DD | Name | Created defect |
| YYYY-MM-DD | Name | Assigned to developer |
| YYYY-MM-DD | Name | Fix applied |
| YYYY-MM-DD | Name | Verified |
| YYYY-MM-DD | Name | Closed |

---

## Example Defects

### Example 1: HIGH SEVERITY - Discount Calculation Error
```
Title: 10% discount calculates as 11%
Severity: High
Steps: Add $100 item, apply 10% discount, check total
Expected: Subtotal $100, discount $10, total $90 (+ tax)
Actual: Subtotal $100, discount $11, total $89 (+ tax)
Root Cause: Rounding error in discount calculation
Fix: Round to 2 decimals before applying discount
```

### Example 2: MEDIUM SEVERITY - UI Misalignment
```
Title: Receipt total label misaligned on mobile
Severity: Medium
Steps: Generate receipt, view on iPhone 12
Expected: Labels and values aligned properly
Actual: Total label doesn't align with amount
Root Cause: CSS media query for mobile missing
Fix: Add proper CSS grid alignment for mobile
```

### Example 3: CRITICAL - Data Loss
```
Title: Offline sales not syncing after network restore
Severity: Critical
Steps: Create 5 sales offline, restore network, check reports
Expected: All 5 sales appear in reports
Actual: Sales created but not syncing, reports show 0 sales
Root Cause: Sync process crashing on large queue
Fix: Implement batch sync with error handling
```

---

## Templates for Common Defect Types

### Calculation Error Template
- Affected calculation: [Formula]
- Input values: [Specific values that fail]
- Expected result: [Math]
- Actual result: [Math]
- Difference: [Percentage/amount off]

### Layout/UI Template
- Browser/device: [Specific]
- Screen size: [Specific]
- Expected appearance: [Description]
- Actual appearance: [Description]
- Visual evidence: [Screenshot]

### Data Inconsistency Template
- Source of truth: [Table/system]
- Reported value: [Value]
- Actual value: [Value]
- Last known good state: [When/what]
- Recovery steps: [How to restore]

### Performance Template
- Operation: [What's slow]
- Expected time: [<X seconds]
- Actual time: [>Y seconds]
- Data load: [How much data]
- Bottleneck: [Where it's slow]

### Security/Access Template
- Vulnerability type: [SQL injection, XSS, etc.]
- How to exploit: [Specific steps]
- What's exposed: [Sensitive data, system function]
- Impact: [What damage could occur]
- Mitigation: [Temporary workaround]
