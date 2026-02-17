# Production Security Hardening - Setup Guide

This guide will help you configure the new security features that have been implemented.

## Required Environment Variables

Add the following to your `.env` file:

```bash
# CSRF Protection (REQUIRED)
CSRF_SECRET=<generate-using-openssl-rand-base64-32>

# Session Security (Optional but Recommended)
SESSION_FINGERPRINT_SECRET=<generate-using-openssl-rand-base64-32>
SESSION_ABSOLUTE_TIMEOUT=86400000  # 24 hours in milliseconds
SESSION_IDLE_TIMEOUT=1800000       # 30 minutes in milliseconds

# Request Limits (Optional - defaults provided)
MAX_REQUEST_SIZE=100kb
```

### Generating Secrets

Use OpenSSL to generate cryptographically secure secrets:

```bash
# Generate CSRF_SECRET
openssl rand -base64 32

# Generate SESSION_FINGERPRINT_SECRET
openssl rand -base64 32
```

## Frontend Integration

### CSRF Token Handling

The backend now requires CSRF tokens for all state-changing operations (POST, PUT, PATCH, DELETE).

#### 1. Reading the CSRF Token

The CSRF token is provided in two ways:

- **Cookie**: `csrf-token` (HTTP-only, SameSite=Strict)
- **Header**: `X-CSRF-Token` (readable by JavaScript)

#### 2. Sending the CSRF Token

Include the token in the `X-CSRF-Token` header for all state-changing requests:

```typescript
// Example using fetch
const response = await fetch('/api/v1/auth/logout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCsrfToken(), // Read from X-CSRF-Token response header
  },
  credentials: 'include', // Important: include cookies
});

// Helper function to get CSRF token from last response
function getCsrfToken(): string {
  // Store the token from the X-CSRF-Token response header
  // You can store it in memory, localStorage, or a state management solution
  return sessionStorage.getItem('csrf-token') || '';
}
```

#### 3. Axios Integration Example

```typescript
import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

// Response interceptor to capture CSRF token
api.interceptors.response.use((response) => {
  const csrfToken = response.headers['x-csrf-token'];
  if (csrfToken) {
    sessionStorage.setItem('csrf-token', csrfToken);
  }
  return response;
});

// Request interceptor to add CSRF token
api.interceptors.request.use((config) => {
  const csrfToken = sessionStorage.getItem('csrf-token');
  if (csrfToken && config.method !== 'get') {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

export default api;
```

## Security Features Implemented

### 1. CSRF Protection

- **Pattern**: Double Submit Cookie
- **Scope**: All POST, PUT, PATCH, DELETE requests
- **Exempt**: GET, HEAD, OPTIONS, webhooks, health checks
- **Token Rotation**: Automatic rotation on successful validation

### 2. Input Validation & Sanitization

- **XSS Prevention**: HTML tag stripping, script removal
- **SQL Injection**: Pattern detection and blocking
- **NoSQL Injection**: Dangerous operator filtering
- **Path Traversal**: Directory traversal prevention
- **Command Injection**: Shell command character filtering

### 3. Rate Limiting

- **Algorithm**: Sliding window (Redis-based)
- **Scope**: Per-IP, per-user, per-endpoint
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Fail-Safe**: Fails open if Redis is unavailable

### 4. Security Headers

- **HSTS**: Strict-Transport-Security with 1-year max-age
- **CSP**: Content-Security-Policy with strict directives
- **X-Frame-Options**: DENY (prevents clickjacking)
- **X-Content-Type-Options**: nosniff
- **Permissions-Policy**: Restricts browser features

### 5. Intrusion Detection

- **Pattern Detection**: SQL injection, XSS, path traversal, command injection
- **Automatic Blocking**: IP blocking after threshold violations
- **Honeypots**: Fake endpoints to detect bots
- **Brute Force Protection**: Tracks failed auth attempts

### 6. Request Validation

- **Size Limits**: 100KB for JSON, 10MB for files
- **Content-Type**: Validates allowed content types
- **URL Length**: Maximum 2048 characters
- **Sanitization**: Automatic input sanitization

## Testing

### 1. CSRF Protection Test

```bash
# Should fail without CSRF token
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"

# Should succeed with CSRF token
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer <token>" \
  -H "X-CSRF-Token: <csrf-token>" \
  -H "Content-Type: application/json" \
  -b "csrf-token=<csrf-token>"
```

### 2. Rate Limiting Test

```bash
# Send multiple requests to trigger rate limit
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
```

### 3. Security Headers Test

```bash
# Check security headers
curl -I http://localhost:3000/api/v1/auth/me
```

## Monitoring

### Security Logs

Security events are logged to:

- **Console**: Development environment
- **Files**: Production environment
  - `logs/security.log` - All security events
  - `logs/security-error.log` - Security errors only

### Key Metrics to Monitor

1. **CSRF Violations**: `CSRF_TOKEN_INVALID` events
2. **Rate Limit Hits**: `RATE_LIMIT_EXCEEDED` events
3. **Injection Attempts**: `SQL_INJECTION_ATTEMPT`, `XSS_ATTEMPT`, etc.
4. **IP Blocks**: `IP_BLOCKED` events
5. **Failed Logins**: `LOGIN_FAILURE` events

## Troubleshooting

### CSRF Token Issues

**Problem**: "CSRF token missing" error

**Solutions**:

1. Ensure cookies are enabled
2. Verify `withCredentials: true` in fetch/axios
3. Check that `X-CSRF-Token` header is being sent
4. Verify the token matches between cookie and header

### Rate Limiting Issues

**Problem**: Legitimate users getting rate limited

**Solutions**:

1. Increase rate limits in `security.config.ts`
2. Implement user-specific rate limits for authenticated users

### Redis Connection Issues

**Problem**: Rate limiting or intrusion detection not working

**Solutions**:

1. Verify Redis connection in `UPSTASH_REDIS_REST_URL`
2. Check Redis credentials in `UPSTASH_REDIS_REST_TOKEN`
3. Monitor Redis logs for connection errors

## Production Checklist

- [ ] Generate and set `CSRF_SECRET` environment variable
- [ ] Generate and set `SESSION_FINGERPRINT_SECRET` environment variable
- [ ] Update frontend to handle CSRF tokens
- [ ] Test CSRF protection in staging
- [ ] Test rate limiting in staging
- [ ] Verify security headers are present
- [ ] Set up security log monitoring
- [ ] Configure alerts for security events
- [ ] Review and adjust rate limits based on traffic
- [ ] Enable HSTS preload (after testing)
- [ ] Document security procedures for team

## Additional Resources

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
