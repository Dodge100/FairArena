# FairArena API Reference

> **Version:** 1.0.0
> **Base URL:** `https://fairarena.app/api/v1`
> **Last Updated:** 2025-12-30

---

## Table of Contents

1. [Authentication](#authentication)
2. [Common Response Formats](#common-response-formats)
3. [Rate Limiting](#rate-limiting)
4. [API Endpoints](#api-endpoints)
   - [Profile](#profile)
   - [Organization](#organization)
   - [Team](#team)
   - [Credits](#credits)
   - [Payments](#payments)
   - [Plans](#plans)
   - [Notifications](#notifications)
   - [Settings](#settings)
   - [AI Assistant](#ai-assistant)
   - [Support](#support)
   - [Feedback](#feedback)
   - [Stars](#stars)
   - [Newsletter](#newsletter)
5. [Webhooks](#webhooks)
6. [Error Codes](#error-codes)

---

## Authentication

### Bearer Token

All API requests require authentication via JWT Bearer token from Clerk.

```http
Authorization: Bearer <clerk_jwt_token>
```

### Token Retrieval

```javascript
// Frontend (React)
import { useAuth } from '@clerk/clerk-react';

const { getToken } = useAuth();
const token = await getToken();

// API Call
fetch('/api/v1/profile', {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

---

## Common Response Formats

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## Rate Limiting

### Default Limits

| Tier       | Requests/Minute | Burst |
| ---------- | --------------- | ----- |
| Standard   | 60              | 10    |
| Premium    | 120             | 20    |
| Enterprise | 300             | 50    |

### Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1703958000
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "retryAfter": 45
  }
}
```

---

## API Endpoints

### Profile

#### Get Current User Profile

```http
GET /profile
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "clp1234567890",
    "userId": "user_abc123",
    "bio": "Full-stack developer passionate about open source",
    "firstName": "John",
    "lastName": "Doe",
    "skills": ["TypeScript", "React", "Node.js"],
    "interests": ["AI", "Web3", "DevOps"],
    "languages": ["English", "Spanish"],
    "location": "San Francisco, CA",
    "company": "TechCorp",
    "jobTitle": "Senior Engineer",
    "yearsOfExperience": 5,
    "isPublic": true,
    "requireAuth": false,
    "trackViews": true,
    "portfolioUrl": "https://johndoe.dev",
    "githubUsername": "johndoe",
    "linkedInProfile": "https://linkedin.com/in/johndoe",
    "twitterHandle": "johndoe",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-12-30T15:45:00.000Z"
  }
}
```

#### Update Profile

```http
PUT /profile
```

**Request Body:**

```json
{
  "bio": "Updated bio text",
  "skills": ["TypeScript", "React", "Go"],
  "location": "New York, NY",
  "isPublic": true
}
```

**Response:**

```json
{
  "success": true,
  "message": "Profile update queued",
  "eventId": "evt_123456"
}
```

#### View Public Profile

```http
GET /profile/view/:userId
```

**Query Parameters:**

| Parameter | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| userId    | string | Yes      | Target user's ID |

**Response:**

```json
{
  "success": true,
  "data": {
    "profile": { ... },
    "starCount": 42,
    "viewCount": 156,
    "isStarred": false
  }
}
```

---

### Organization

#### List User Organizations

```http
GET /organization
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "org_abc123",
      "name": "TechCorp",
      "slug": "techcorp",
      "isPublic": true,
      "myRole": "Owner",
      "memberCount": 25,
      "teamCount": 5,
      "profile": {
        "description": "Building the future of tech",
        "logoUrl": "https://...",
        "website": "https://techcorp.io"
      }
    }
  ]
}
```

#### Create Organization

```http
POST /organization
```

**Request Body:**

```json
{
  "name": "My Startup",
  "slug": "my-startup",
  "isPublic": true,
  "timezone": "America/Los_Angeles",
  "profile": {
    "description": "We build cool stuff",
    "website": "https://mystartup.io"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "org_xyz789",
    "name": "My Startup",
    "slug": "my-startup",
    "createdAt": "2024-12-30T16:00:00.000Z"
  }
}
```

#### Get Organization Details

```http
GET /organization/:orgId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "org_abc123",
    "name": "TechCorp",
    "slug": "techcorp",
    "isPublic": true,
    "joinEnabled": false,
    "timezone": "UTC",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "profile": {
      "description": "...",
      "website": "...",
      "logoUrl": "...",
      "bannerUrl": "...",
      "location": "San Francisco, CA"
    },
    "stats": {
      "memberCount": 25,
      "teamCount": 5,
      "projectCount": 12
    }
  }
}
```

#### Update Organization

```http
PATCH /organization/:orgId
```

**Request Body:**

```json
{
  "name": "TechCorp Inc",
  "isPublic": false,
  "joinEnabled": true,
  "profile": {
    "description": "Updated description"
  }
}
```

#### Delete Organization

```http
DELETE /organization/:orgId
```

**Response:**

```json
{
  "success": true,
  "message": "Organization deletion scheduled",
  "eventId": "evt_del_123"
}
```

#### List Organization Teams

```http
GET /organization/:orgId/teams
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "team_abc",
      "name": "Engineering",
      "slug": "engineering",
      "visibility": "INTERNAL",
      "memberCount": 10
    }
  ]
}
```

#### Get Organization Audit Logs

```http
GET /organization/:orgId/audit
```

**Query Parameters:**

| Parameter | Type   | Default | Description           |
| --------- | ------ | ------- | --------------------- |
| limit     | number | 50      | Max results           |
| offset    | number | 0       | Pagination offset     |
| action    | string | -       | Filter by action type |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "log_abc",
      "userId": "user_123",
      "action": "member.invited",
      "level": "INFO",
      "createdAt": "2024-12-30T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

---

### Team

#### Create Team

```http
POST /team
```

**Request Body:**

```json
{
  "organizationId": "org_abc123",
  "name": "Backend Team",
  "slug": "backend-team",
  "visibility": "INTERNAL",
  "joinEnabled": false
}
```

#### Get Team Details

```http
GET /team/:teamId
```

#### Update Team

```http
PATCH /team/:teamId
```

#### Delete Team

```http
DELETE /team/:teamId
```

#### Invite to Team

```http
POST /team/invite
```

**Request Body:**

```json
{
  "teamId": "team_abc",
  "email": "newmember@example.com",
  "roleId": "role_member",
  "message": "Welcome to the team!"
}
```

#### Accept Team Invite

```http
POST /team/accept-invite
```

**Request Body:**

```json
{
  "code": "invite_code_here"
}
```

---

### Credits

#### Get Credit Balance

```http
GET /credits/balance
```

**Response:**

```json
{
  "success": true,
  "data": {
    "balance": 250,
    "lastUpdated": "2024-12-30T15:00:00.000Z"
  }
}
```

#### Get Credit History

```http
GET /credits/history
```

**Query Parameters:**

| Parameter | Type   | Default | Description                |
| --------- | ------ | ------- | -------------------------- |
| limit     | number | 50      | Max results (1-100)        |
| offset    | number | 0       | Pagination offset          |
| type      | string | -       | Filter by transaction type |

**Response:**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "ctx_abc123",
        "amount": 100,
        "balance": 250,
        "type": "PURCHASE",
        "description": "Pro Plan purchase",
        "createdAt": "2024-12-30T14:00:00.000Z",
        "payment": {
          "razorpayOrderId": "order_xyz",
          "planName": "Pro"
        }
      },
      {
        "id": "ctx_def456",
        "amount": -20,
        "balance": 150,
        "type": "DEDUCTION",
        "description": "AI Assistant usage",
        "createdAt": "2024-12-29T10:00:00.000Z"
      }
    ],
    "total": 25,
    "limit": 50,
    "offset": 0
  }
}
```

#### Check Free Credits Eligibility

```http
GET /credits/eligibility
```

**Response:**

```json
{
  "success": true,
  "data": {
    "eligible": true,
    "reason": "Phone number not verified",
    "requirements": {
      "phoneVerified": false,
      "hasNotClaimed": true
    },
    "reward": {
      "credits": 50,
      "description": "First-time bonus credits"
    }
  }
}
```

#### Claim Free Credits

```http
POST /credits/claim
```

**Request Body:**

```json
{
  "verificationToken": "verified_token_from_otp"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "creditsAwarded": 50,
    "newBalance": 50,
    "transactionId": "ctx_new123"
  }
}
```

#### Send SMS OTP

```http
POST /credits/send-otp
```

**Request Body:**

```json
{
  "phoneNumber": "+919876543210",
  "isResend": false
}
```

**Response:**

```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "expiresIn": 300,
    "attemptsRemaining": 4
  }
}
```

#### Verify SMS OTP

```http
POST /credits/verify-otp
```

**Request Body:**

```json
{
  "otp": "123456"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "verified": true,
    "verificationToken": "vrf_token_xyz"
  }
}
```

#### Send Voice OTP

```http
POST /credits/send-voice-otp
```

**Request Body:**

```json
{
  "phoneNumber": "+919876543210"
}
```

#### Verify Voice OTP

```http
POST /credits/verify-voice-otp
```

---

### Payments

#### Create Payment Order

```http
POST /payments/create-order
```

**Request Body:**

```json
{
  "planId": "plan_pro"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "orderId": "order_xyz789",
    "razorpayOrderId": "order_Lxyz123",
    "amount": 49900,
    "currency": "INR",
    "key": "rzp_live_xxxxx",
    "name": "FairArena",
    "description": "Pro Plan - 600 Credits",
    "prefill": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

#### Verify Payment

```http
POST /payments/verify
```

**Request Body:**

```json
{
  "razorpay_order_id": "order_Lxyz123",
  "razorpay_payment_id": "pay_Lxyz456",
  "razorpay_signature": "signature_hash"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "paymentId": "pay_internal_123",
    "status": "COMPLETED",
    "creditsAdded": 600,
    "newBalance": 850
  }
}
```

#### Get Payment History

```http
GET /payments/history
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "pay_123",
      "razorpayOrderId": "order_xyz",
      "razorpayPaymentId": "pay_abc",
      "planName": "Pro",
      "amount": 499,
      "currency": "INR",
      "credits": 600,
      "status": "COMPLETED",
      "createdAt": "2024-12-30T10:00:00.000Z",
      "completedAt": "2024-12-30T10:01:00.000Z"
    }
  ]
}
```

---

### Plans

#### List Available Plans

```http
GET /plans
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "clp_starter",
      "planId": "plan_starter",
      "name": "Starter",
      "amount": 99,
      "currency": "INR",
      "credits": 100,
      "description": "Perfect for getting started",
      "features": ["100 credits", "Basic support", "Standard processing"],
      "isActive": true
    },
    {
      "id": "clp_pro",
      "planId": "plan_pro",
      "name": "Pro",
      "amount": 499,
      "currency": "INR",
      "credits": 600,
      "description": "Best value for regular users",
      "features": ["600 credits (+20% bonus)", "Priority support", "Faster processing"],
      "isActive": true
    },
    {
      "id": "clp_enterprise",
      "planId": "plan_enterprise",
      "name": "Enterprise",
      "amount": 1999,
      "currency": "INR",
      "credits": 3000,
      "description": "For power users and teams",
      "features": [
        "3000 credits (+50% bonus)",
        "Dedicated support",
        "Priority processing",
        "Custom features"
      ],
      "isActive": true
    }
  ]
}
```

#### Get Plan Details

```http
GET /plans/:planId
```

---

### Notifications

#### List Notifications

```http
GET /notifications
```

**Query Parameters:**

| Parameter | Type    | Default | Description                 |
| --------- | ------- | ------- | --------------------------- |
| limit     | number  | 20      | Max results                 |
| offset    | number  | 0       | Pagination offset           |
| read      | boolean | -       | Filter by read status       |
| type      | string  | -       | Filter by notification type |

**Response:**

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif_abc123",
        "type": "STAR",
        "title": "New Profile Star",
        "message": "Jane Doe starred your profile",
        "description": "Someone appreciated your work!",
        "read": false,
        "actionUrl": "/profile/jane-doe",
        "actionLabel": "View Profile",
        "createdAt": "2024-12-30T15:30:00.000Z"
      }
    ],
    "unreadCount": 5,
    "total": 42
  }
}
```

#### Mark Notifications as Read

```http
POST /notifications/mark-read
```

**Request Body:**

```json
{
  "notificationIds": ["notif_abc", "notif_def"]
}
```

#### Mark All as Read

```http
POST /notifications/mark-all-read
```

#### Mark as Unread

```http
POST /notifications/mark-unread
```

**Request Body:**

```json
{
  "notificationIds": ["notif_abc"]
}
```

#### Delete Notifications

```http
DELETE /notifications
```

**Request Body:**

```json
{
  "notificationIds": ["notif_abc", "notif_def"]
}
```

#### Delete All Read Notifications

```http
DELETE /notifications/read
```

---

### Settings

#### Get User Settings

```http
GET /settings
```

**Response:**

```json
{
  "success": true,
  "data": {
    "settings": {
      "theme": "dark",
      "language": "en",
      "timezone": "America/Los_Angeles",
      "notifications": {
        "email": true,
        "push": true,
        "marketing": false
      },
      "privacy": {
        "showEmail": false,
        "showPhone": false,
        "allowMessages": true
      },
      "accessibility": {
        "reducedMotion": false,
        "highContrast": false
      }
    },
    "updatedAt": "2024-12-30T10:00:00.000Z"
  }
}
```

#### Update Settings

```http
PUT /settings
```

**Request Body:**

```json
{
  "theme": "light",
  "notifications": {
    "email": false
  }
}
```

#### Reset Settings to Default

```http
POST /settings/reset
```

---

### AI Assistant

#### Send Chat Message

```http
POST /ai/chat
```

**Request Body:**

```json
{
  "message": "What are my current credits?",
  "sessionId": "session_abc123",
  "context": {
    "currentPage": "/dashboard",
    "pageContent": "..."
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "response": "Based on your account, you currently have 250 credits available. Would you like me to help you with anything else?",
    "sessionId": "session_abc123",
    "toolsUsed": ["get_user_credits"],
    "metadata": {
      "tokensUsed": 150,
      "processingTime": 1.2
    }
  }
}
```

#### Stream Chat Response

```http
POST /ai/stream
```

**Request Body:**

```json
{
  "message": "Explain my organization structure",
  "sessionId": "session_abc123"
}
```

**Response:** Server-Sent Events stream

```
data: {"chunk": "Based on", "type": "text"}
data: {"chunk": " your account,", "type": "text"}
data: {"chunk": " you belong to", "type": "text"}
...
data: {"type": "done", "toolsUsed": ["get_user_organizations"]}
```

---

### Support

#### Create Support Ticket

```http
POST /support
```

**Request Body:**

```json
{
  "subject": "Payment issue",
  "message": "I was charged but didn't receive credits",
  "type": "BUG",
  "severity": "HIGH"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "ticketId": "sup_abc123",
    "subject": "Payment issue",
    "status": "QUEUED",
    "createdAt": "2024-12-30T16:00:00.000Z"
  },
  "message": "Support ticket created. You will receive an email confirmation."
}
```

#### List User Support Tickets

```http
GET /support
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "sup_abc123",
      "subject": "Payment issue",
      "status": "IN_REVIEW",
      "severity": "HIGH",
      "type": "BUG",
      "createdAt": "2024-12-30T16:00:00.000Z",
      "updatedAt": "2024-12-30T17:00:00.000Z"
    }
  ]
}
```

---

### Feedback

#### Submit Feedback

```http
POST /feedback
```

**Request Body:**

```json
{
  "feedbackCode": "fc_weekly_123",
  "rating": 5,
  "message": "Great platform! Love the AI assistant."
}
```

**Response:**

```json
{
  "success": true,
  "message": "Thank you for your feedback!"
}
```

---

### Stars

#### Star a Profile

```http
POST /stars/:profileId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "starred": true,
    "newCount": 43
  }
}
```

#### Unstar a Profile

```http
DELETE /stars/:profileId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "starred": false,
    "newCount": 42
  }
}
```

---

### Newsletter

#### Subscribe to Newsletter

```http
POST /newsletter/subscribe
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "preferences": {
    "weekly": true,
    "product": true,
    "events": false
  }
}
```

#### Unsubscribe from Newsletter

```http
POST /newsletter/unsubscribe
```

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

---

## Webhooks

### Clerk Webhook

```http
POST /webhooks/v1/clerk
```

**Supported Events:**

- `user.created`
- `user.updated`
- `user.deleted`

**Headers:**

```http
svix-id: msg_abc123
svix-timestamp: 1703958000
svix-signature: v1,signature_here
```

### Razorpay Webhook

```http
POST /webhooks/v1/razorpay
```

**Supported Events:**

- `payment.captured`
- `payment.failed`
- `refund.created`
- `refund.processed`
- `refund.failed`

**Headers:**

```http
X-Razorpay-Signature: hmac_signature
```

### GitHub Webhook

```http
POST /webhooks/v1/github
```

**Supported Events:**

- `push`
- `pull_request`
- `issues`

---

## Error Codes

### Authentication Errors (4xx)

| Code             | HTTP Status | Description                |
| ---------------- | ----------- | -------------------------- |
| `AUTH_REQUIRED`  | 401         | No authentication provided |
| `AUTH_INVALID`   | 401         | Invalid or expired token   |
| `AUTH_FORBIDDEN` | 403         | Insufficient permissions   |

### Validation Errors (400)

| Code               | Description                        |
| ------------------ | ---------------------------------- |
| `VALIDATION_ERROR` | Request body validation failed     |
| `INVALID_PHONE`    | Invalid phone number format        |
| `INVALID_EMAIL`    | Invalid email format               |
| `INVALID_PLAN`     | Plan does not exist or is inactive |

### Rate Limiting (429)

| Code               | Description                |
| ------------------ | -------------------------- |
| `RATE_LIMITED`     | Too many requests          |
| `OTP_RATE_LIMITED` | Too many OTP requests      |
| `LOCKOUT`          | Account temporarily locked |

### Payment Errors (402)

| Code                   | Description                           |
| ---------------------- | ------------------------------------- |
| `PAYMENT_FAILED`       | Payment processing failed             |
| `INSUFFICIENT_CREDITS` | Not enough credits for operation      |
| `SIGNATURE_MISMATCH`   | Payment signature verification failed |

### Resource Errors (404)

| Code                | Description                 |
| ------------------- | --------------------------- |
| `USER_NOT_FOUND`    | User does not exist         |
| `ORG_NOT_FOUND`     | Organization does not exist |
| `TEAM_NOT_FOUND`    | Team does not exist         |
| `PROFILE_NOT_FOUND` | Profile does not exist      |

### Conflict Errors (409)

| Code              | Description                  |
| ----------------- | ---------------------------- |
| `DUPLICATE_ENTRY` | Resource already exists      |
| `ALREADY_CLAIMED` | Free credits already claimed |
| `INVITE_USED`     | Invite code already used     |

### Server Errors (5xx)

| Code                  | HTTP Status | Description                     |
| --------------------- | ----------- | ------------------------------- |
| `INTERNAL_ERROR`      | 500         | Unexpected server error         |
| `SERVICE_UNAVAILABLE` | 503         | Service temporarily unavailable |
| `MAINTENANCE`         | 503         | System under maintenance        |

---

_For interactive API testing, visit `/api-docs` in development/staging environments._
