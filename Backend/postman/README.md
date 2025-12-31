# FairArena API Reference

Complete API documentation and Postman collection for the FairArena platform.

---

## Quick Start

### 1. Import the Collection

1. Open Postman
2. Click **Import** → **File**
3. Select `FairArena_API.postman_collection.json`

### 2. Set Up Environment

Import the environment file:
- `FairArena_API.postman_environment.json` (Development)
- `FairArena_API_Production.postman_environment.json` (Production)

### 3. Configure Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `baseUrl` | API server URL | `http://localhost:3000` |
| `clerkToken` | Your Clerk JWT token | `eyJhbGci...` |
| `recaptchaToken` | reCAPTCHA token | `03AFcWeA...` |

### 4. Get Your Clerk Token

1. Sign in to FairArena
2. Open browser DevTools (**F12**)
3. Go to **Application** → **Cookies**
4. Copy the `__session` cookie value

---

## API Endpoints

### Profile (`/api/v1/profile`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/public/:userId` | ❌ | Get public profile |
| GET | `/me` | ✅ | Get own profile |
| PUT | `/me` | ✅ | Update profile |
| POST | `/:profileId/view` | ✅ | Record profile view |
| GET | `/views` | ✅ | Get profile view analytics |

### Credits (`/api/v1/credits`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/balance` | ✅ | Get credit balance |
| GET | `/history` | ✅ | Get transaction history |
| GET | `/check-eligibility` | ✅ | Check free credits eligibility |
| POST | `/claim-free` | ✅ | Claim 200 free credits |
| POST | `/send-sms-otp` | ✅ | Send phone verification OTP |
| POST | `/verify-sms-otp` | ✅ | Verify SMS OTP |
| POST | `/send-voice-otp` | ✅ | Send voice call OTP |
| POST | `/verify-voice-otp` | ✅ | Verify voice OTP |

### Account Settings (`/api/v1/account-settings`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/send-otp` | ✅ | Send email verification OTP |
| POST | `/verify-otp` | ✅ | Verify email OTP |
| GET | `/status` | ✅ | Check verification status |
| GET | `/logs` | ✅ | Get account activity logs |
| POST | `/export-data` | ✅ | Export user data (GDPR) |

### Organizations (`/api/v1/organization`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✅ | List user organizations |
| POST | `/create/new` | ✅ | Create organization |
| GET | `/:slug` | ✅ | Get organization details |
| PUT | `/:slug/settings` | ✅ | Update organization settings |
| GET | `/:slug/teams` | ✅ | Get organization teams |
| GET | `/:slug/members` | ✅ | Get organization members |
| GET | `/:slug/audit-logs` | ✅ | Get organization audit logs |
| DELETE | `/:slug` | ✅ | Delete organization |

### Teams (`/api/v1/team`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/organization/:orgSlug/teams` | ✅ | List organization teams |
| POST | `/organization/:orgSlug/teams` | ✅ | Create team |
| GET | `/organization/:orgSlug/team/:teamSlug` | ✅ | Get team details |
| PUT | `/organization/:orgSlug/team/:teamSlug` | ✅ | Update team |
| DELETE | `/organization/:orgSlug/team/:teamSlug` | ✅ | Delete team |
| GET | `/organization/:orgSlug/team/:teamSlug/roles` | ✅ | Get team roles |

### Team Invitations (`/api/v1/team`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/invite/:inviteCode` | ❌ | Get invitation details |
| POST | `/invite/:inviteCode/accept` | ✅ | Accept invitation |
| POST | `/invite/:inviteCode/decline` | ✅ | Decline invitation |
| POST | `/organization/:org/team/:team/invites` | ✅ | Send team invite |
| POST | `/organization/:org/team/:team/invites/bulk` | ✅ | Send bulk invites |
| GET | `/organization/:org/team/:team/invites` | ✅ | List team invitations |
| DELETE | `/organization/:org/team/:team/invites/:id` | ✅ | Revoke invitation |

### AI Assistant (`/api/v1/ai`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/stream` | ✅ | Stream AI chat (SSE) |
| POST | `/chat` | ✅ | AI chat (non-streaming) |
| DELETE | `/session/:sessionId` | ✅ | Clear AI session |

### Notifications (`/api/v1/notifications`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✅ | Get all notifications |
| GET | `/unread/count` | ✅ | Get unread count |
| PATCH | `/:id/read` | ✅ | Mark as read |
| PATCH | `/:id/unread` | ✅ | Mark as unread |
| PATCH | `/read/multiple` | ✅ | Mark multiple as read |
| PATCH | `/read/all` | ✅ | Mark all as read |
| DELETE | `/:id` | ✅ | Delete notification |
| DELETE | `/read/all` | ✅ | Delete all read notifications |

### Stars (`/api/v1/stars`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/star` | ✅ | Star a profile |
| POST | `/unstar` | ✅ | Unstar a profile |
| GET | `/profile/:profileId/status` | ✅ | Check star status |
| GET | `/profile/:userId` | ❌ | Get profile stars |

### Payments (`/api/v1/payments`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/create-order` | ✅ | Create Razorpay order |
| POST | `/verify-payment` | ✅ | Verify payment signature |
| POST | `/webhook` | ❌ | Payment webhook (Razorpay) |

### Plans (`/api/v1/plans`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ❌ | List all plans |
| GET | `/:planId` | ❌ | Get plan details |

### User Settings (`/api/v1/settings`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✅ | Get user settings |
| PUT | `/` | ✅ | Update settings |
| POST | `/reset` | ✅ | Reset to defaults |

### Reports (`/api/v1/reports`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✅ | Get my reports |
| POST | `/` | ✅ | Create report |

### Feedback (`/api/v1/feedback`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/:feedbackCode` | ❌ | Get feedback by code |
| POST | `/:feedbackCode` | ❌ | Submit feedback |

### Newsletter (`/api/v1/newsletter`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/subscribe` | ❌ | Subscribe to newsletter |
| POST | `/unsubscribe` | ❌ | Unsubscribe from newsletter |

### Support (`/api/v1/support`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | ❌ | Create support request |
| GET | `/` | ✅ | Get my support tickets |

### Platform Invite (`/api/v1/platform`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/invite` | ✅ | Invite user to platform |

### Health (`/healthz`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/healthz` | ❌ | Health check |

---

## Authentication

Most endpoints require a Clerk JWT token:

```http
Authorization: Bearer <clerk_jwt_token>
```

## Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Standard | 100 requests | 1 minute |
| Authentication | 10 requests | 1 minute |
| OTP | 3 requests | 24 hours |

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

## HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not Found |
| `429` | Rate Limit Exceeded |
| `500` | Server Error |

---

## Phone Verification Flow

1. **Send OTP**: `POST /credits/send-sms-otp`
2. **Verify OTP**: `POST /credits/verify-sms-otp`
3. **Claim Credits**: `POST /credits/claim-free`

### Restrictions
- 3 OTP requests per 24 hours
- 2 minute cooldown between requests
- 5 verification attempts per OTP
- Temporary/VoIP numbers blocked

---

## Support

- Email: fairarena.contact@gmail.com
- API Issues: Create support ticket via `/api/v1/support`

---

*Last updated: December 2024*
