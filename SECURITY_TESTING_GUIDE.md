# Aether POS - Security Testing Guide

**Document Date**: March 3, 2026
**Testing Framework**: Manual + Automated
**Target**: Enterprise Security Standard

---

## Quick Start Testing

### Prerequisites

```bash
# Install dependencies
npm install

# Build backend
cd backend
npm run build

# In another terminal, start backend
npm start

# In another terminal, start frontend (optional)
cd frontend
npm run dev
```

### Run All Security Tests

```bash
cd backend

# Unit tests including security
npm test

# Manual security checks
npm run security-check
```

---

## OWASP Top 10 Testing

### A1: Broken Access Control

#### Test Case 1: Unauthorized User Access

**Objective**: Verify unauthorized users cannot access protected endpoints

**Steps**:
```bash
# 1. Try accessing admin endpoint without token
curl -X GET http://localhost:4000/api/admin/users

# Expected: 401 Unauthorized
# Actual: [record result]
```

**Verification Script**:
```bash
#!/bin/bash
ENDPOINT="http://localhost:4000/api/admin/users"
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null $ENDPOINT)

if [ "$RESPONSE" = "401" ]; then
  echo "✓ PASS: Unauthorized access blocked (401)"
else
  echo "✗ FAIL: Expected 401, got $RESPONSE"
fi
```

#### Test Case 2: Role-Based Access Control

**Objective**: Verify users can only access endpoints for their role

**Steps**:
```bash
# 1. Register regular user
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "SecurePass123!"
  }'

# 2. Login and get token
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "SecurePass123!"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')

# 3. Try accessing admin endpoint with user token
curl -X GET http://localhost:4000/api/admin/settings \
  -H "Authorization: Bearer $TOKEN"

# Expected: 403 Forbidden
```

#### Test Case 3: Horizontal Privilege Escalation

**Objective**: Verify user cannot access other users' data

**Steps**:
```bash
# 1. Create two users
USER1=$(curl -s -X POST http://localhost:4000/auth/register \
  -d '{"email":"user1@test.com","password":"SecurePass123!"}' \
  -H "Content-Type: application/json" | jq -r '.id')

USER2=$(curl -s -X POST http://localhost:4000/auth/register \
  -d '{"email":"user2@test.com","password":"SecurePass123!"}' \
  -H "Content-Type: application/json" | jq -r '.id')

# 2. Login as USER1
TOKEN1=$(curl -s -X POST http://localhost:4000/auth/login \
  -d '{"email":"user1@test.com","password":"SecurePass123!"}' \
  -H "Content-Type: application/json" | jq -r '.accessToken')

# 3. Try to access USER2's profile
curl -X GET "http://localhost:4000/api/users/$USER2" \
  -H "Authorization: Bearer $TOKEN1"

# Expected: 403 Forbidden (USER1 cannot access USER2's data)
```

---

### A2: Cryptographic Failures

#### Test Case 1: HTTPS Enforcement

**Objective**: Verify HTTPS is enforced in production

**Steps**:
```bash
# Check certificate validity
openssl s_client -connect localhost:443 -tls1_2 < /dev/null

# Verify TLS version is 1.2+
# Expected: TLSv1.2 or TLSv1.3
```

#### Test Case 2: Password Hashing

**Objective**: Verify passwords are properly hashed

**Steps**:
```bash
# 1. Register user
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hashtest@test.com",
    "password": "SecurePass123!"
  }'

# 2. Query database
psql -c "SELECT password FROM users WHERE email='hashtest@test.com';"

# Expected: Long hash starting with $2a$, $2b$, or $2y$ (bcrypt)
# NOT the plain password: "SecurePass123!"
```

#### Test Case 3: Encryption Key Management

**Objective**: Verify encryption keys are not exposed

**Steps**:
```bash
# Check that ENCRYPTION_KEY is not in logs
grep -r "ENCRYPTION_KEY" /var/log/app/*.log || echo "✓ PASS: Key not in logs"

# Check that secrets are not in code
grep -r "encryption_key\|JWT_SECRET" backend/src/ || echo "✓ PASS: Secrets not in code"
```

---

### A3: Injection (SQL, XSS, Command)

#### Test Case 1: SQL Injection

**Objective**: Verify application is protected against SQL injection

**Payloads to Test**:
```
Email inputs:
  admin' OR '1'='1
  ' UNION SELECT * FROM users --
  '; DROP TABLE users; --

Password inputs:
  ' OR '1'='1
  admin' --
  ' UNION ALL SELECT NULL --
```

**Test Steps**:
```bash
# Test SQL injection payload
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin' OR '1'='1",
    "password": "anything"
  }'

# Expected: 400 Bad Request or 401 Unauthorized
# NOT: Database error revealing SQL syntax
```

#### Test Case 2: XSS Injection

**Objective**: Verify application prevents XSS attacks

**Payloads to Test**:
```
<script>alert('XSS')</script>
<img src="x" onerror="alert('XSS')">
<svg onload="alert('XSS')">
javascript:alert('XSS')
data:text/html,<script>alert('XSS')</script>
```

**Test Steps**:
```bash
# Test XSS in registration
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test<script>alert(1)</script>@test.com",
    "password": "SecurePass123!"
  }'

# Expected: Input sanitized, no script execution
```

#### Test Case 3: Command Injection

**Objective**: Verify no OS command injection possible

**Payloads to Test**:
```
; ls -la
| cat /etc/passwd
` whoami `
$(command)
```

**Test**: Attempt injection in file upload, export, etc.

---

### A4: Insecure Design

#### Test Case 1: Missing Rate Limiting

**Objective**: Verify rate limiting is enforced

**Steps**:
```bash
# Make 60+ requests in 1 minute
for i in {1..70}; do
  curl -X GET http://localhost:4000/health
done

# Should get 429 Too Many Requests after limit exceeded
```

#### Test Case 2: Missing Timeout

**Objective**: Verify session timeout is enforced

**Steps**:
```bash
# Login to get token
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -d '{"email":"test@test.com","password":"SecurePass123!"}' \
  -H "Content-Type: application/json" | jq -r '.accessToken')

# Wait for timeout (30 minutes)
sleep 1800

# Try using old token
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Expected: 401 Unauthorized (token expired)
```

---

### A5: Security Misconfiguration

#### Test Case 1: Default Credentials

**Objective**: Verify no default credentials exist

**Credentials to Try**:
```
admin / admin
admin / password
root / password
test / test
```

**Test**:
```bash
for PASS in admin password test 123456; do
  RESPONSE=$(curl -s -X POST http://localhost:4000/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"admin@test.com\",\"password\":\"$PASS\"}")
  
  if echo $RESPONSE | grep -q "accessToken"; then
    echo "✗ FAIL: Default credentials work!"
  fi
done

echo "✓ PASS: No default credentials found"
```

#### Test Case 2: Security Headers Present

**Objective**: Verify all security headers are present

**Steps**:
```bash
# Get headers
curl -v http://localhost:4000/health 2>&1 | grep -i "^< "

# Check for required headers:
# - Strict-Transport-Security
# - Content-Security-Policy
# - X-Frame-Options: DENY
# - X-Content-Type-Options: nosniff
# - X-XSS-Protection
```

**Test Script**:
```bash
#!/bin/bash
HEADERS=$(curl -s -i http://localhost:4000/health)

check_header() {
  if echo "$HEADERS" | grep -iq "^$1:"; then
    echo "✓ PASS: $1 present"
  else
    echo "✗ FAIL: $1 missing"
  fi
}

check_header "Strict-Transport-Security"
check_header "Content-Security-Policy"
check_header "X-Frame-Options"
check_header "X-Content-Type-Options"
check_header "X-XSS-Protection"
```

#### Test Case 3: Information Disclosure

**Objective**: Verify error messages don't leak sensitive info

**Steps**:
```bash
# Trigger error with invalid input
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d 'invalid json'

# Response should NOT contain:
# - Stack trace
# - Database error details
# - File paths
# - Technology details (except in dev mode)
```

---

### A6: Vulnerable Components

#### Test Case 1: Dependency Vulnerabilities

**Objective**: Verify no known vulnerabilities in dependencies

**Steps**:
```bash
cd backend
npm audit

# Expected: 0 vulnerabilities

# If found, fix with:
npm audit fix
npm audit fix --force  # Only if necessary
```

#### Test Case 2: Outdated Dependencies

**Steps**:
```bash
npm outdated

# Review output for critical/high severity packages
# Update if available:
npm update
```

---

### A7: Authentication Failures

#### Test Case 1: Weak Password Rejection

**Objective**: Verify weak passwords are rejected

**Weak Passwords**:
```
password       # No numbers, special chars
12345          # No letters
Abc123         # No special char
pass           # Too short
```

**Test**:
```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "weak"
  }'

# Expected: 400 Bad Request with error message
# ✓ Password must be at least 8 characters
```

#### Test Case 2: Brute Force Protection

**Objective**: Verify account locks after failed attempts

**Steps**:
```bash
# 1. Make 6 failed login attempts
for i in {1..6}; do
  RESPONSE=$(curl -s -X POST http://localhost:4000/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "brutetest@test.com",
      "password": "wrongpassword"
    }')
  
  STATUS=$(echo $RESPONSE | jq -r '.error // .message')
  echo "Attempt $i: $STATUS"
done

# Expected:
# Attempts 1-5: "Invalid credentials"
# Attempt 6: "Too many failed attempts" or "Account locked"
```

#### Test Case 3: Session Timeout

**Objective**: Verify sessions timeout after inactivity

**Steps**:
```bash
# Configure timeout in .env
SESSION_TIMEOUT_MINUTES=1

# Login
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -d '{"email":"test@test.com","password":"SecurePass123!"}' \
  -H "Content-Type: application/json" | jq -r '.accessToken')

# Use token immediately - should work
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK

# Wait 61 seconds (timeout is 1 minute)
sleep 61

# Try again - should fail
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer $TOKEN"
# Expected: 401 Unauthorized
```

---

### A8: Software & Data Integrity

#### Test Case 1: Dependencies Checked

**Steps**:
```bash
npm list
npm audit
# Verify all dependencies are legitimate
```

#### Test Case 2: Code Review

**Steps**:
```bash
# Review for suspicious code
grep -r "eval\|setTimeout(.*string)\|Function(.*string)" src/

# Should return no results
```

---

### A9: Logging & Monitoring

#### Test Case 1: Sensitive Operations Logged

**Objective**: Verify audit logs are created

**Steps**:
```bash
# 1. Register and login
curl -X POST http://localhost:4000/auth/register \
  -d '{"email":"audittest@test.com","password":"SecurePass123!"}' \
  -H "Content-Type: application/json"

# 2. Query audit logs
curl -X GET http://localhost:4000/api/security/audit-summary \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: Logs show LOGIN, REGISTER actions
# Contains: timestamp, actor, action, resource, IP address
```

#### Test Case 2: Log Completeness

**Objective**: Verify logs contain sufficient detail

**Checks**:
```
✓ Timestamp (UTC)
✓ User ID / Actor
✓ Action type
✓ Resource accessed
✓ IP Address
✓ User Agent
✓ Success/Failure status
✓ Metadata (if applicable)
```

---

### A10: CSRF (Cross-Site Request Forgery)

#### Test Case 1: CSRF Token Validation

**Objective**: Verify CSRF tokens are validated for state-changing operations

**Steps**:
1. Login and get CSRF token
2. Create form with invalid CSRF token
3. Submit form

**Expected**: 403 Forbidden

#### Test Case 2: SameSite Cookie Attribute

**Objective**: Verify SameSite attribute is set

**Steps**:
```bash
curl -v http://localhost:4000/health 2>&1 | grep -i "Set-Cookie"

# Expected: Set-Cookie header includes "SameSite=Strict"
```

---

## Manual Penetration Testing Checklist

### Authentication Testing

- [ ] **Password Policies**
  - [ ] Minimum length enforced (8+ chars)
  - [ ] Complexity required (uppercase, number, special)
  - [ ] Previous passwords not reusable
  - [ ] Password expiration enforced

- [ ] **Session Management**
  - [ ] Session timeout works (30 min inactivity)
  - [ ] Session IDs are random (can't predict)
  - [ ] Sessions invalidate on logout
  - [ ] HTTPS only flag set
  - [ ] HttpOnly flag set
  - [ ] SameSite=Strict set

- [ ] **Account Lockout**
  - [ ] Lockout after 5 failed attempts ✓
  - [ ] Lockout duration is 15 minutes ✓
  - [ ] Lockout applies to login endpoint ✓

### Authorization Testing

- [ ] **Role-Based Access Control**
  - [ ] Users can only access their role's resources
  - [ ] Cross-role access denied
  - [ ] Privilege escalation attempts fail
  - [ ] Admin endpoints require admin role

### Encryption Testing

- [ ] **Data at Rest**
  - [ ] Sensitive data encrypted (AES-256)
  - [ ] Keys not hardcoded
  - [ ] Encryption algorithm validated

- [ ] **Data in Transit**
  - [ ] HTTPS enforced
  - [ ] TLS 1.2+
  - [ ] Certificate valid
  - [ ] No mixed HTTP/HTTPS

### Input Validation

- [ ] **Boundary Testing**
  - [ ] Very long inputs rejected
  - [ ] Empty/null inputs handled
  - [ ] Special characters escaped
  - [ ] Negative numbers handled

- [ ] **Injection Testing**
  - [ ] SQL injection attempts fail
  - [ ] XSS payloads sanitized
  - [ ] Command injection blocked
  - [ ] LDAP injection protected

### Business Logic

- [ ] **Payment Authorization**
  - [ ] Cannot process without valid payment method
  - [ ] Cannot submit twice (duplicate prevention)
  - [ ] Amount validation
  - [ ] User authorization verified

## CI/CD Security Testing

### Automated Tests

```bash
# Run security tests in CI/CD pipeline
npm install
npm run build
npm test
npm run security-check
npm audit
```

### Pre-Deployment Checks

```bash
# Before deploying to production
npm audit                    # Check vulnerabilities
npm test                     # Run all tests
npm run build               # Verify build succeeds
npm run security-check      # Security-specific tests
```

---

## Test Results Template

```
Test Date: __________
Tester: __________
Environment: Development / Staging / Production

✓ = PASS
✗ = FAIL
⚠ = WARNING

## OWASP Top 10 Results
- [ ] A1: Broken Access Control - ✓
- [ ] A2: Cryptographic Failures - ✓
- [ ] A3: Injection - ✓
- [ ] A4: Insecure Design - ✓
- [ ] A5: Security Misconfiguration - ✓
- [ ] A6: Vulnerable Components - ✓
- [ ] A7: Authentication Failures - ✓
- [ ] A8: Software Integrity - ✓
- [ ] A9: Logging & Monitoring - ✓
- [ ] A10: CSRF - ✓

## Overall Assessment
Status: PASS / FAIL
Critical Issues: ___
High Issues: ___
Medium Issues: ___
Low Issues: ___

Recommendations:
_______________
_______________

Sign-Off: ___________  Date: __________
```

---

## Test Schedule

- **Daily**: Automated CI/CD tests
- **Weekly**: Manual security review
- **Monthly**: Full OWASP testing
- **Quarterly**: Professional penetration test
- **Annually**: Comprehensive security audit + SOC2

---

**Document Classification**: Internal Use
**Last Updated**: March 3, 2026
