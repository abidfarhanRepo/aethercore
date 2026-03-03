# Aether POS - Defect Tracking & Management Procedures

## Overview
Centralized defect tracking system to manage all issues found during QA, development, and production.

## Defect Lifecycle

```
NEW 
  ↓ (Triage)
OPEN
  ↓ (Assign to developer)
IN PROGRESS
  ↓ (Developer fixes)
RESOLVED
  ↓ (QA verifies)
VERIFIED
  ↓ (Release)
CLOSED
```

## Creating a Defect

### Step 1: Gather Information
When you find a defect:
1. Reproduce the issue (can you repeat it?)
2. Document steps to reproduce
3. Capture screenshots or videos
4. Check logs for error messages
5. Note environment details

### Step 2: Complete Defect Form
Use template: `defect-tracking-template.md`

**Required Fields**:
- Title (one-line description)
- Severity (Critical/High/Medium/Low)
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (browser, OS, app version)

**Optional But Helpful**:
- Screenshots
- Video recording
- Log files
- Related defects
- Affected workflows

### Step 3: Submit Defect
```bash
1. Create file: defects/AUTO-XXX.md
2. Fill template completely
3. Assign default severity/priority
4. Attach supporting files
5. Submit for triaging
```

### Example Defect Title Formats
```
❌ Bad: "Login broken"
✅ Good: "Invalid password login fails on Firefox with timeout"

❌ Bad: "Report wrong"
✅ Good: "Daily sales report shows 0 revenue when discount applied"

❌ Bad: "Bug in discount"
✅ Good: "Percentage discount rounds incorrectly on $99.99 subtotal"
```

## Defect Triage

### Triage Meeting
**When**: Daily at 9:30 AM
**Who**: QA Lead, Dev Lead, Product Owner
**Duration**: 15-30 minutes
**Purpose**: Review new defects, assess severity, prioritize fixes

### Severity Assessment

| Severity | Definition | Example | Fix Timeline |
|----------|-----------|---------|--------------|
| Critical | System down, data loss, security breach | "All sales deleted after logout" | <1 hour |
| High | Feature completely broken, wrong calculation | "Discount not applied" | <4 hours |
| Medium | Partial feature broken, workaround exists | "Report slow to load (60 sec)" | <1 day |
| Low | Non-critical issue, limited impact | "Button text has typo" | <1 week |

### Priority Assessment

| Priority | Criteria | Timeline |
|----------|----------|----------|
| Immediate | Blocks release or production-affecting | Must fix before next release |
| High | High impact but can work around | Should fix in current sprint |
| Normal | Medium impact, non-blocking | Can fix in current/next sprint |
| Low | Low impact, cosmetic | Can defer to future release |

### Triage Decision
```
For each defect:
1. Confirm reproducibility
2. Assess true severity
3. Assign priority
4. Determine if critical path blocker
5. Assign to developer or backlog
6. Set target fix date
```

## Defect States

### NEW
- Just created
- Waiting for triage
- Action: Wait for triage meeting

### OPEN
- Triaged and confirmed
- Assigned to developer
- Action: Developer begins work

### IN PROGRESS
- Developer is actively fixing
- QA may be investigating further
- Action: Monitor for questions/blockers

### RESOLVED
- Developer claims fix is complete
- Commit/PR created
- Status: Awaiting QA verification
- Action: QA verifies fix

### VERIFIED
- QA confirmed fix works
- No regressions found
- Status: Ready to close
- Action: Move to next release/close

### CLOSED
- Fix released to production
- OR deemed invalid/duplicate
- OR deferred with justification
- Lesson learned documented

## Severity vs Priority

### Severity = Technical Impact
- How bad is the problem?
- What breaks?
- How much data affected?
- Can you work around it?

### Priority = Business Impact
- How urgent to fix?
- Who does it affect?
- Can we release without it?
- When should it be fixed?

### Matrix Example
```
            Low Priority    Normal    High    Immediate
Critical    Deploy soon     Hot fix   Hot     NOW!
High        This sprint     Soon      Today   ASAP
Medium      Next sprint     This      Soon    Today
Low         Backlog         Later     Soon    This week
```

## Workflow Examples

### Example 1: Critical Defect
```
Friday 2 PM: QA finds "Inventory goes negative"
2:05 PM    : Create AUTO-045, mark Critical/Immediate
2:10 PM    : Notify dev team Slack channel immediately
2:15 PM    : Conference call with dev lead
2:20 PM    : Developer assigned, starts investigation
2:45 PM    : Root cause identified (missing validation)
3:00 PM    : Fix implemented, code review
3:15 PM    : Fix deployed to QA environment
3:30 PM    : QA verifies fix, checks for regressions
3:45 PM    : Fix verified, merged to main
4:00 PM    : Defect moved to VERIFIED
Monday 9am : Auto-deploy to production, defect CLOSED
```

### Example 2: High Defect
```
Tuesday 10 AM : QA finds "Discount not applying"
10:15 AM      : Create AUTO-046, mark High/High
10:30 AM      : Add to dev backlog, plan for today
11:00 AM      : Developer starts investigation
2:00 PM       : Fix implemented
2:30 PM       : Code reviewed and approved
3:00 PM       : Deployed to QA, verified
4:00 PM       : Merged, status = VERIFIED
Next release  : Defect CLOSED
```

### Example 3: Medium Defect
```
Wednesday 2 PM : QA reports "Report charts slow"
2:15 PM        : Create AUTO-047, mark Medium/Normal
2:30 PM        : Triage: Assign to developer
Friday         : Developer investigates and implements fix
Monday         : QA verifies fix
Same week      : Merged to main
```

## Communication

### Immediate Notification (Critical)
```
1. Slack pinned message in #defects channel
2. Call to dev lead
3. Escalate to product owner if production issue
```

### Daily Updates (Open Defects)
```
Daily standup includes:
- New defects created
- Defects moved to IN PROGRESS
- Defects resolved and verified
```

### Weekly Report
```
Subject: Weekly Defect Report

Total Defects: X
- New: X
- Open: X
- In Progress: X
- Resolved: X
- Verified: X

Critical/High Open: X (list)
Status: On track / At risk / Blocked
```

## Defect Metrics

### Track These Metrics
```
1. Defect Arrival Rate
   - New defects per day
   - Trend: Should stable or decreasing

2. Defect Fix Rate
   - Defects closed per day
   - Trend: Should match or exceed arrival rate

3. Open Defect Trend
   - Total open defects over time
   - Trend: Should decrease to zero before release

4. Defect by Severity
   - % Critical vs High vs Medium vs Low
   - Target: <10% critical, 80% medium/low

5. Mean Time to Fix (MTTF)
   - Average days from NEW to CLOSED
   - Target: Critical <1 day, High <3 days, Medium <7 days

6. Regression Rate
   - % of defects that reappear after fix
   - Target: <2%

7. Escape Rate
   - % of defects that reach production
   - Target: <1%
```

## Dashboard

### Daily Defect Dashboard
```
Status              Count   Trend   Oldest  Critical?
NEW (waiting)       3       ↓       2h      No
OPEN (assigned)     8       ↑       1d      1 Critical
IN PROGRESS         5       →       1d      No
RESOLVED (verify)   4       →       2h      No
VERIFIED (ready)    2       ↓       6h      No

Backlog Defects: 12 (deferred/low priority)
```

### Burndown Chart (by Release)
```
Opening Sprint (X defects) → Closing Sprint (0 defects)
Day 1:  X defects
Day 2:  X-2 defects ✓
Day 3:  X-4 defects ✓
Day 4:  X-3 defects (new found) ⚠
Day 5:  X-6 defects ✓
...
Zero when: All fixed, verified, closed
```

## Defect Analysis

### Common Root Causes
```
1. Logic Error (40%)
   - Developer error in implementation
   - Fix: Better code review, unit tests

2. API Contract Mismatch (20%)
   - Front/back not synchronized
   - Fix: Better API design, integration tests

3. Missing Validation (15%)
   - Input not checked
   - Fix: Add input validation

4. Configuration Issue (10%)
   - Wrong settings, env vars
   - Fix: Better config documentation

5. Third-party Integration (8%)
   - Auth, payment, etc.
   - Fix: Better error handling, fallbacks

6. Concurrency Issue (4%)
   - Race conditions, locking
   - Fix: Proper async handling, locks

7. Other (3%)
```

### Common Defect Types
- **Off-by-One**: Quantity, pagination, array indices
- **Rounding**: Currency, tax, discount calculations
- **Timezone**: Date comparisons across timezones
- **Boundary**: First, last, empty, max value
- **Permission**: Access control failures
- **Integration**: API contract mismatches
- **Performance**: Slow queries, missing indexes
- **Regression**: Previously fixed issues reappearing

## Defect Prevention

### Code Review Checklist
```
✓ Manual test walkthrough
✓ Edge cases considered
✓ Error handling present
✓ Input validation present
✓ Database constraints checked
✓ Concurrency handled
✓ Logging sufficient
✓ Comments clear
✓ Tests included
✓ Performance assessed
```

### Testing Checklist
```
✓ Unit tests for logic
✓ Integration tests for workflows
✓ E2E tests for user paths
✓ Edge case tests
✓ Error handling tests
✓ Performance tests
✓ Security tests
✓ Regression tests pass
```

### Process Improvements
```
Monthly Review Questions:
1. What types of defects are we finding most?
2. Could earlier testing have caught these?
3. Are we getting smarter about prevention?
4. What process changes would help?
5. How's team skill in this area?
```

## Escalation

### When to Escalate
```
1. Critical defect: Immediately
2. High defect blocking multiple features: Same day
3. High defect open >3 days: Escalate
4. Cannot reproduce: Escalate for help
5. Disagreement on severity: Escalate
6. Need expertise: Escalate to SME
```

### Escalation Path
```
QA Engineer
    ↓ (Can't resolve)
QA Lead
    ↓ (Need dev help)
Dev Lead
    ↓ (Need product decision)
Product Owner
    ↓ (Need business decision)
Leadership
```

## Archival & Learning

### Keep Defects Forever For:
- Search capability (same issue next time)
- Metric trending
- Root cause analysis
- Team learning
- Audit trail

### Quarterly Reviews
```
Questions:
- What lessons did we learn?
- What improvements did we make?
- What defects keep reappearing?
- What training is needed?
- What tools would help?
- What processes should change?
```

## Release Gate

### Before Production Release
```
All defects must be either:
✅ CLOSED (fixed and verified)
✅ DEFERRED (documented, approved, tracked for next release)
✅ INVALID (not a real defect)
✅ NOT INCLUDED (feature not in release)

NOT ALLOWED:
❌ OPEN defects
❌ IN PROGRESS defects
❌ RESOLVED but not verified
❌ CRITICAL/HIGH open defects (any state)
```

## Tools & Integration

### Defect System
- GitHub Issues (for code-tracked defects)
- Spreadsheet (for non-code defects)
- Jira (if organization uses it)

### Integration with Development
```
Workflow:
1. QA creates defect in issue tracker
2. Assign to developer
3. Developer creates branch: fix/AUTO-###
4. PR linked to defect
5. QA verifies in PR
6. PR merged
7. Defect marked VERIFIED
8. Release to production
9. Defect marked CLOSED
```

### Notification Integration
```
When defect created → Slack notification
When moved to IN PROGRESS → Slack notification
When marked RESOLVED → Slack notification
When CRITICAL created → Team call
```

## SLA (Service Level Agreement)

### Response Time (from NEW)
- Critical: < 30 minutes
- High: < 2 hours
- Medium: < 24 hours
- Low: < 5 days

### Fix Time (from OPEN)
- Critical: < 1 hour
- High: < 4 hours
- Medium: < 1 day
- Low: < 1 week

### Verification Time (from RESOLVED)
- All: < 24 hours

### Closure Time (from VERIFIED)
- < Next release

## Defect Queries

### Find defects by criteria:
```
# All critical defects
status:"OPEN" AND severity:"Critical"

# Oldest high-priority defects
severity:"High" AND priority:"Immediate" ORDER BY created

# Defects opened this week
created:>2024-03-04 AND created:<2024-03-11

# Unassigned defects
assignee:empty AND status:"OPEN"

# Defects by component
component:"Payment" AND status:"OPEN"

# Regression defects
title:*regression* OR label:regression
```
