# FairArena Data Flow Documentation

> **Version:** 1.0.0
> **Last Updated:** 2025-12-30
> **Status:** Production Ready

---

## Table of Contents

1. [Request Lifecycle](#request-lifecycle)
2. [User Workflows](#user-workflows)
3. [Organization Workflows](#organization-workflows)
4. [Payment Workflows](#payment-workflows)
5. [Notification Workflows](#notification-workflows)
6. [Background Job Flows](#background-job-flows)
7. [Data Synchronization](#data-synchronization)

---

## Request Lifecycle

### HTTP Request Flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#1e3a5f'}}}%%
flowchart TB
    subgraph CLIENT["Client"]
        A["HTTP Request"]
    end

    subgraph EDGE["Edge Layer"]
        B["Cloudflare CDN/WAF"]
        C["Caddy Reverse Proxy"]
    end

    subgraph MIDDLEWARE["Middleware Pipeline"]
        D["Helmet - Security Headers"]
        E["HPP - Parameter Pollution"]
        F["CORS - Origin Validation"]
        G["Clerk - JWT Extraction"]
        H["Cookie Parser"]
        I["JSON Body Parser"]
        J["Arcjet - Rate Limiting"]
        K["Maintenance Check"]
    end

    subgraph ROUTING["Route Handler"]
        L["Route Matcher"]
        M["Auth Middleware"]
        N["Permission Middleware"]
        O["Controller Method"]
    end

    subgraph SERVICE["Service Layer"]
        P["Business Logic"]
        Q["Cache Check"]
        R["Database Query"]
        S["External API Call"]
    end

    subgraph RESPONSE["Response"]
        T["JSON Response"]
        U["Error Handler"]
    end

    A --> B --> C
    C --> D --> E --> F --> G --> H --> I --> J --> K
    K --> L --> M --> N --> O
    O --> P
    P --> Q
    Q -->|Cache Hit| T
    Q -->|Cache Miss| R --> T
    P --> S --> T
    O -->|Error| U --> T

    style CLIENT fill:#3b82f6,color:#fff
    style EDGE fill:#f59e0b,color:#000
    style MIDDLEWARE fill:#10b981,color:#fff
    style ROUTING fill:#8b5cf6,color:#fff
    style SERVICE fill:#06b6d4,color:#fff
    style RESPONSE fill:#6366f1,color:#fff
```

### Request Context Propagation

```mermaid
%%{init: {'theme': 'base'}}%%
sequenceDiagram
    participant C as Client
    participant M as Middleware
    participant H as Handler
    participant S as Service
    participant D as Database

    C->>M: Request + JWT Token
    Note over M: Extract userId, email from JWT
    M->>M: Attach to req.auth
    M->>H: req with auth context
    H->>H: Validate permissions
    H->>S: Pass userId, context
    S->>D: Query with userId filter
    D-->>S: Filtered results
    S-->>H: Domain objects
    H-->>C: JSON response

    Note over C,D: Trace ID propagated through all layers
```

---

## User Workflows

### User Registration Flow

```mermaid
%%{init: {'theme': 'base'}}%%
sequenceDiagram
    autonumber
    participant U as User
    participant F as Frontend
    participant CL as Clerk
    participant W as Webhook
    participant I as Inngest
    participant DB as Database
    participant R as Redis
    participant E as Email

    U->>F: Click Sign Up
    F->>CL: Redirect to Clerk
    CL->>CL: OAuth/Email Sign Up
    CL-->>F: JWT Token

    Note over CL,E: Async: Webhook Processing
    CL->>W: POST /webhooks/v1/clerk
    Note right of W: Event: user.created
    W->>W: Verify Signature
    W->>I: Emit user/sync

    rect rgb(200, 230, 255)
        Note over I,E: Inngest Function: syncUser
        I->>DB: Check if user exists
        DB-->>I: Not found
        I->>DB: INSERT User
        I->>DB: INSERT Profile (default)
        I->>DB: INSERT Settings (default)
        I->>R: Clear user caches
        I->>E: Send Welcome Email
    end

    E-->>U: Welcome Email Received
```

### User Login Flow

```mermaid
%%{init: {'theme': 'base'}}%%
sequenceDiagram
    autonumber
    participant U as User
    participant F as Frontend
    participant CL as Clerk
    participant A as API
    participant R as Redis
    participant DB as Database

    U->>F: Enter Credentials
    F->>CL: Authenticate
    CL-->>F: JWT Token + User Info
    F->>F: Store Token in Memory

    F->>A: GET /api/v1/profile
    Note over A: Clerk Middleware validates JWT
    A->>R: Get profile:cache:{userId}

    alt Cache Hit
        R-->>A: Cached Profile
    else Cache Miss
        A->>DB: SELECT * FROM Profile
        DB-->>A: Profile Data
        A->>R: SET profile:cache:{userId}
    end

    A-->>F: Profile Response
    F->>F: Render Dashboard
```

### Profile Update Flow

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart TB
    subgraph CLIENT["Client Request"]
        A["PUT /api/v1/profile"]
        B["Request Body: {bio, skills, ...}"]
    end

    subgraph VALIDATION["Validation Layer"]
        C["Zod Schema Validation"]
        D["Sanitize Input (DOMPurify)"]
    end

    subgraph ASYNC["Async Processing"]
        E["Emit profile/update Event"]
        F["Inngest: updateProfileFunction"]
    end

    subgraph PERSIST["Data Persistence"]
        G["UPDATE Profile SET ..."]
        H["CREATE Logs (audit)"]
    end

    subgraph CACHE["Cache Invalidation"]
        I["DELETE profile:cache:{userId}"]
        J["DELETE related caches"]
    end

    subgraph RESPONSE["Response"]
        K["202 Accepted"]
        L["eventId for tracking"]
    end

    A --> B --> C --> D
    D --> E --> F
    F --> G --> H
    H --> I --> J
    E --> K --> L

    style CLIENT fill:#3b82f6,color:#fff
    style VALIDATION fill:#10b981,color:#fff
    style ASYNC fill:#ec4899,color:#fff
    style PERSIST fill:#6366f1,color:#fff
    style CACHE fill:#f59e0b,color:#000
    style RESPONSE fill:#84cc16,color:#000
```

### Profile View Tracking

```mermaid
%%{init: {'theme': 'base'}}%%
sequenceDiagram
    autonumber
    participant V as Viewer
    participant A as API
    participant I as Inngest
    participant DB as Database
    participant N as Notification

    V->>A: GET /api/v1/profile/view/{userId}
    A->>A: Check profile.trackViews
    A->>A: Check profile.isPublic
    A->>A: Check profile.requireAuth

    alt Profile settings allow view
        A->>I: Emit profile/view.record
        A-->>V: 200 OK + Profile Data

        rect rgb(255, 230, 230)
            Note over I,N: Async: Record View
            I->>DB: UPSERT ProfileView
            I->>N: Notify profile owner
        end
    else Access denied
        A-->>V: 403 Forbidden
    end
```

---

## Organization Workflows

### Organization Creation Flow

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart TB
    subgraph REQUEST["Create Request"]
        A["POST /api/v1/organization"]
        B["{name, slug, isPublic}"]
    end

    subgraph VALIDATION["Validation"]
        C["Validate name uniqueness"]
        D["Validate slug format"]
        E["Check user limits"]
    end

    subgraph CREATE["Transaction"]
        F["BEGIN TRANSACTION"]
        G["INSERT Organization"]
        H["INSERT OrganizationProfile"]
        I["INSERT OrganizationRole (Owner)"]
        J["INSERT UserOrganization"]
        K["INSERT OrganizationUserRole"]
        L["COMMIT"]
    end

    subgraph ASYNC["Background Tasks"]
        M["Emit org/created"]
        N["Create default roles"]
        O["Send notification"]
    end

    subgraph CACHE["Cache Updates"]
        P["Invalidate user orgs cache"]
        Q["Warm org cache"]
    end

    A --> B --> C --> D --> E
    E --> F --> G --> H --> I --> J --> K --> L
    L --> M --> N --> O
    L --> P --> Q

    style REQUEST fill:#3b82f6,color:#fff
    style VALIDATION fill:#10b981,color:#fff
    style CREATE fill:#6366f1,color:#fff
    style ASYNC fill:#ec4899,color:#fff
    style CACHE fill:#f59e0b,color:#000
```

### Organization Member Invitation Flow

```mermaid
%%{init: {'theme': 'base'}}%%
sequenceDiagram
    autonumber
    participant A as Admin
    participant API as API Server
    participant DB as Database
    participant I as Inngest
    participant E as Email Service
    participant U as Invitee

    A->>API: POST /api/v1/organization/{id}/invite
    Note right of A: {email, roleId, message}

    API->>API: Verify admin permissions
    API->>DB: Check existing invite

    alt Already invited
        API-->>A: 409 Conflict
    else New invite
        API->>DB: CREATE OrganizationInviteCode
        API->>I: Emit org/invite.send
        API-->>A: 201 Created

        rect rgb(230, 255, 230)
            Note over I,U: Async: Email Delivery
            I->>E: Send Invite Email
            E-->>U: Email with invite link
        end
    end

    U->>API: GET /invite/{code}
    API->>DB: Validate code + expiry

    alt Valid & Unused
        API->>DB: BEGIN TRANSACTION
        API->>DB: UPDATE InviteCode SET used=true
        API->>DB: INSERT UserOrganization
        API->>DB: INSERT OrganizationUserRole
        API->>DB: COMMIT
        API-->>U: 200 OK - Joined
    else Invalid/Expired
        API-->>U: 400 Invalid invite
    end
```

### Organization Permission Check

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart TB
    subgraph REQUEST["Incoming Request"]
        A["Any Org Endpoint"]
        B["Extract orgId, userId"]
    end

    subgraph CACHE["Cache Layer"]
        C["Check org:permissions:{userId}:{orgId}"]
    end

    subgraph LOOKUP["Permission Lookup"]
        D["Query OrganizationUserRole"]
        E["Join OrganizationRole"]
        F["Extract permissions JSON"]
    end

    subgraph CHECK["Permission Check"]
        G["Required permission?"]
        H{"Has permission?"}
        I["Proceed to handler"]
        J["403 Forbidden"]
    end

    subgraph CACHE_WRITE["Cache Result"]
        K["SET permissions cache (TTL: 5min)"]
    end

    A --> B --> C
    C -->|Hit| G
    C -->|Miss| D --> E --> F --> K --> G
    G --> H
    H -->|Yes| I
    H -->|No| J

    style REQUEST fill:#3b82f6,color:#fff
    style CACHE fill:#f59e0b,color:#000
    style LOOKUP fill:#6366f1,color:#fff
    style CHECK fill:#10b981,color:#fff
    style CACHE_WRITE fill:#f59e0b,color:#000
```

---

## Payment Workflows

### Complete Payment Flow

```mermaid
%%{init: {'theme': 'base'}}%%
stateDiagram-v2
    [*] --> SelectPlan: User selects plan
    SelectPlan --> CreateOrder: Click Pay
    CreateOrder --> OrderCreated: POST /payments/create-order
    OrderCreated --> CheckoutOpen: Open Razorpay Modal
    CheckoutOpen --> EnterDetails: User enters card
    EnterDetails --> Processing: Submit payment
    Processing --> Captured: Payment successful
    Processing --> Failed: Payment failed
    Captured --> Verify: POST /payments/verify
    Verify --> Completed: Signature valid
    Verify --> Failed: Signature invalid
    Completed --> CreditsAdded: Inngest: Add credits
    CreditsAdded --> EmailSent: Send success email
    EmailSent --> [*]
    Failed --> RetryOption: Show error
    RetryOption --> CheckoutOpen: Retry
    RetryOption --> [*]: Cancel

    note right of Processing
        WebSocket updates UI
        with real-time status
    end note

    note right of Completed
        Webhook provides
        async confirmation
    end note
```

### Payment Data Flow Detail

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart TB
    subgraph PHASE1["Phase 1: Order Creation"]
        A1["Client: Select Plan"]
        A2["API: Validate Plan"]
        A3["Razorpay: Create Order"]
        A4["DB: Create Payment (PENDING)"]
        A5["Inngest: Emit order.created"]
        A6["Client: Receive orderId"]
    end

    subgraph PHASE2["Phase 2: Payment"]
        B1["Razorpay Modal Opens"]
        B2["User Enters Card Details"]
        B3["Razorpay Processes Payment"]
        B4["Razorpay Returns payment_id, signature"]
    end

    subgraph PHASE3["Phase 3: Verification"]
        C1["Client: POST /verify"]
        C2["API: Compute HMAC"]
        C3{"Signature Match?"}
        C4["DB: Update to COMPLETED"]
        C5["Inngest: Emit verified"]
        C6["Error: SIGNATURE_MISMATCH"]
    end

    subgraph PHASE4["Phase 4: Fulfillment"]
        D1["Get User & Payment Data"]
        D2["Calculate Credits"]
        D3["DB: Create CreditTransaction"]
        D4["Redis: Invalidate Credits Cache"]
        D5["DB: Create Notification"]
        D6["Email: Send Receipt"]
    end

    subgraph PHASE5["Phase 5: Webhook (Async)"]
        E1["Razorpay: POST /webhooks"]
        E2["Verify Webhook Signature"]
        E3["Check for Duplicate Event"]
        E4["Store PaymentWebhookEvent"]
        E5["Process Based on Type"]
    end

    A1 --> A2 --> A3 --> A4 --> A5 --> A6
    A6 --> B1 --> B2 --> B3 --> B4
    B4 --> C1 --> C2 --> C3
    C3 -->|Yes| C4 --> C5
    C3 -->|No| C6
    C5 --> D1 --> D2 --> D3 --> D4 --> D5 --> D6

    E1 --> E2 --> E3 --> E4 --> E5

    style PHASE1 fill:#3b82f6,color:#fff
    style PHASE2 fill:#8b5cf6,color:#fff
    style PHASE3 fill:#10b981,color:#fff
    style PHASE4 fill:#f59e0b,color:#000
    style PHASE5 fill:#ec4899,color:#fff
```

### Credit Transaction Balance Calculation

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart LR
    subgraph TRANSACTIONS["Credit Transactions (Time Order)"]
        T1["T1: INITIAL<br/>+50 credits<br/>Balance: 50"]
        T2["T2: PURCHASE<br/>+100 credits<br/>Balance: 150"]
        T3["T3: DEDUCTION<br/>-20 credits<br/>Balance: 130"]
        T4["T4: BONUS<br/>+25 credits<br/>Balance: 155"]
        T5["T5: DEDUCTION<br/>-30 credits<br/>Balance: 125"]
    end

    subgraph BALANCE["Current Balance"]
        B["Last Transaction<br/>Balance Field<br/>= 125 credits"]
    end

    T1 --> T2 --> T3 --> T4 --> T5 --> B

    style T1 fill:#10b981,color:#fff
    style T2 fill:#10b981,color:#fff
    style T3 fill:#ef4444,color:#fff
    style T4 fill:#10b981,color:#fff
    style T5 fill:#ef4444,color:#fff
    style B fill:#3b82f6,color:#fff
```

---

## Notification Workflows

### Notification Creation Flow

```mermaid
%%{init: {'theme': 'base'}}%%
sequenceDiagram
    autonumber
    participant T as Trigger Source
    participant I as Inngest
    participant DB as Database
    participant R as Redis
    participant WS as WebSocket
    participant U as User Client

    T->>I: Emit notification/send
    Note right of T: {userId, type, title, message}

    rect rgb(230, 230, 255)
        Note over I,U: Inngest: sendNotification
        I->>DB: INSERT Notification
        I->>R: INCR user:unread:{userId}
        I->>WS: Emit to user socket
        WS-->>U: Real-time notification
    end

    U->>U: Show notification toast
    U->>U: Update badge count
```

### Notification State Transitions

```mermaid
%%{init: {'theme': 'base'}}%%
stateDiagram-v2
    [*] --> Created: Notification sent
    Created --> Unread: Default state
    Unread --> Read: User clicks/marks read
    Read --> Unread: Mark as unread
    Unread --> Deleted: User deletes
    Read --> Deleted: User deletes
    Deleted --> [*]

    note right of Unread
        Increments unread counter
        Shows in notification bell
    end note

    note right of Read
        Decrements unread counter
        Sets readAt timestamp
    end note
```

### Batch Notification Operations

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart TB
    subgraph MARK_ALL["Mark All Read"]
        A1["POST /notifications/mark-all-read"]
        A2["Emit notification/mark-all-read"]
        A3["UPDATE SET read=true WHERE userId=X"]
        A4["SET unread:count = 0"]
    end

    subgraph DELETE_READ["Delete All Read"]
        B1["DELETE /notifications/read"]
        B2["Emit notification/delete-all-read"]
        B3["DELETE WHERE userId=X AND read=true"]
    end

    subgraph BULK_MARK["Bulk Mark Read"]
        C1["POST /notifications/mark-read"]
        C2["{notificationIds: [...]}"]
        C3["Emit notification/mark-read (batch)"]
        C4["UPDATE WHERE id IN (...)"]
        C5["DECR unread:count by count"]
    end

    A1 --> A2 --> A3 --> A4
    B1 --> B2 --> B3
    C1 --> C2 --> C3 --> C4 --> C5
```

---

## Background Job Flows

### Daily Cleanup Job

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart TB
    subgraph TRIGGER["Cron Trigger"]
        A["Daily at 3:00 AM UTC"]
    end

    subgraph CLEANUP["Cleanup Tasks"]
        B["Delete expired invite codes"]
        C["Delete old notifications (>90 days)"]
        D["Purge soft-deleted users (>30 days)"]
        E["Clean up orphaned records"]
        F["Rebuild statistics caches"]
    end

    subgraph REPORT["Completion"]
        G["Log cleanup summary"]
        H["Update health metrics"]
    end

    A --> B --> C --> D --> E --> F --> G --> H

    style TRIGGER fill:#8b5cf6,color:#fff
    style CLEANUP fill:#ef4444,color:#fff
    style REPORT fill:#10b981,color:#fff
```

### Weekly Feedback Email Job

```mermaid
%%{init: {'theme': 'base'}}%%
sequenceDiagram
    autonumber
    participant C as Cron
    participant I as Inngest
    participant DB as Database
    participant E as Email Service

    C->>I: Trigger weekly-feedback
    Note over C: Sunday 10:00 AM UTC

    I->>DB: SELECT users for feedback
    Note right of I: Criteria: Active last 7 days
    DB-->>I: User list

    loop For each user
        I->>DB: Get user activity summary
        I->>DB: Generate feedback code
        I->>E: Send personalized email
    end

    I->>I: Log completion metrics
```

### User Data Export Job

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart TB
    subgraph REQUEST["Export Request"]
        A["POST /api/v1/account-settings/export"]
        B["Set export status in Redis"]
        C["Emit user/data.export"]
    end

    subgraph COLLECT["Data Collection"]
        D["Fetch User record"]
        E["Fetch Profile"]
        F["Fetch Settings"]
        G["Fetch Notifications"]
        H["Fetch Payment history"]
        I["Fetch Credit transactions"]
        J["Fetch Organization memberships"]
        K["Fetch Team memberships"]
        L["Fetch Activity logs"]
    end

    subgraph FORMAT["Format & Deliver"]
        M["Compile JSON export"]
        N["Generate download link"]
        O["Send email with link"]
        P["Update export status"]
    end

    A --> B --> C
    C --> D & E & F & G & H & I & J & K & L
    D & E & F & G & H & I & J & K & L --> M
    M --> N --> O --> P

    style REQUEST fill:#3b82f6,color:#fff
    style COLLECT fill:#6366f1,color:#fff
    style FORMAT fill:#10b981,color:#fff
```

---

## Data Synchronization

### Clerk User Sync

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart TB
    subgraph CLERK_EVENTS["Clerk Webhook Events"]
        E1["user.created"]
        E2["user.updated"]
        E3["user.deleted"]
    end

    subgraph HANDLERS["Event Handlers"]
        H1["syncUser"]
        H2["updateUser"]
        H3["deleteUser"]
    end

    subgraph USER_CREATED["User Created Flow"]
        C1["Check existing user"]
        C2["Create User record"]
        C3["Create Profile"]
        C4["Create Settings"]
        C5["Send welcome email"]
    end

    subgraph USER_UPDATED["User Updated Flow"]
        U1["Find existing user"]
        U2["Update User fields"]
        U3["Sync profile image"]
        U4["Invalidate caches"]
    end

    subgraph USER_DELETED["User Deleted Flow"]
        D1["Set isDeleted = true"]
        D2["Set deletedAt = now"]
        D3["Anonymize PII"]
        D4["Send deletion email"]
        D5["Schedule hard delete"]
    end

    E1 --> H1 --> C1 --> C2 --> C3 --> C4 --> C5
    E2 --> H2 --> U1 --> U2 --> U3 --> U4
    E3 --> H3 --> D1 --> D2 --> D3 --> D4 --> D5

    style CLERK_EVENTS fill:#8b5cf6,color:#fff
    style HANDLERS fill:#3b82f6,color:#fff
    style USER_CREATED fill:#10b981,color:#fff
    style USER_UPDATED fill:#f59e0b,color:#000
    style USER_DELETED fill:#ef4444,color:#fff
```

### Read Replica Synchronization

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart TB
    subgraph PRIMARY["Primary Database"]
        P1["Write Operations"]
        P2["Commit Transaction"]
        P3["WAL Entry"]
    end

    subgraph REPLICATION["Streaming Replication"]
        R1["WAL Sender Process"]
        R2["Network Transfer"]
    end

    subgraph REPLICAS["Read Replicas"]
        RR1["Read Replica 1"]
        RR2["Read Replica 2"]
    end

    subgraph APPLICATION["Application Layer"]
        A1["Write Query → Primary"]
        A2["Read Query → Replica Pool"]
        A3["Round-robin selection"]
    end

    P1 --> P2 --> P3
    P3 --> R1 --> R2
    R2 --> RR1 & RR2

    A1 --> P1
    A2 --> A3
    A3 --> RR1
    A3 --> RR2

    style PRIMARY fill:#3b82f6,color:#fff
    style REPLICATION fill:#8b5cf6,color:#fff
    style REPLICAS fill:#10b981,color:#fff
    style APPLICATION fill:#f59e0b,color:#000
```

### Cache Consistency Model

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart TB
    subgraph STRATEGY["Cache-Aside Strategy"]
        S1["Read: Check cache first"]
        S2["Miss: Query database"]
        S3["Write result to cache"]
        S4["Write: Update database"]
        S5["Invalidate cache"]
    end

    subgraph PATTERNS["Invalidation Patterns"]
        P1["Direct key deletion"]
        P2["Pattern-based deletion"]
        P3["TTL expiration"]
    end

    subgraph EXAMPLE["Example: Credit Balance"]
        E1["Read: GET user:credits:abc"]
        E2["Miss: SELECT balance FROM CreditTransaction"]
        E3["Cache: SET user:credits:abc = 150 EX 300"]
        E4["Write: INSERT CreditTransaction"]
        E5["Invalidate: DEL user:credits:abc"]
    end

    STRATEGY --> PATTERNS --> EXAMPLE

    style STRATEGY fill:#3b82f6,color:#fff
    style PATTERNS fill:#f59e0b,color:#000
    style EXAMPLE fill:#10b981,color:#fff
```

---

## Appendix: Event Catalog

### All Inngest Events

| Event Name                   | Trigger           | Handler                     | Data Payload                           |
| ---------------------------- | ----------------- | --------------------------- | -------------------------------------- |
| `user/sync`                  | Clerk webhook     | syncUser                    | `{userId, email, firstName, lastName}` |
| `user/update`                | Clerk webhook     | updateUser                  | `{userId, changes}`                    |
| `user/delete`                | Clerk webhook     | deleteUser                  | `{userId}`                             |
| `user/data.export`           | API request       | exportUserDataHandler       | `{userId, format}`                     |
| `profile/update`             | API request       | updateProfileFunction       | `{userId, data}`                       |
| `profile/view.record`        | Profile view      | recordProfileView           | `{profileId, viewerId}`                |
| `profile/star`               | Star action       | starProfile                 | `{profileId, userId}`                  |
| `profile/unstar`             | Unstar action     | unstarProfile               | `{profileId, userId}`                  |
| `payment/order.created`      | Order creation    | paymentOrderCreated         | `{orderId, userId, planId}`            |
| `payment/verified`           | Payment verify    | paymentVerified             | `{paymentId, userId}`                  |
| `payment/webhook.received`   | Razorpay webhook  | paymentWebhookReceived      | `{eventId, eventType, payload}`        |
| `notification/send`          | Various           | sendNotification            | `{userId, type, title, message}`       |
| `notification/mark-read`     | API request       | markNotificationsAsRead     | `{notificationIds}`                    |
| `notification/mark-all-read` | API request       | markAllNotificationsAsRead  | `{userId}`                             |
| `notification/delete`        | API request       | deleteNotifications         | `{notificationIds}`                    |
| `org/invite.send`            | Org invite        | sendOrgInviteEmail          | `{email, orgId, roleId}`               |
| `team/invite.send`           | Team invite       | sendTeamInviteEmail         | `{email, teamId, roleId}`              |
| `team/invite.process`        | Invite processing | processSingleTeamInvite     | `{inviteId}`                           |
| `team/invite.accept`         | Accept invite     | processTeamInviteAcceptance | `{code, userId}`                       |
| `settings/update`            | Settings update   | updateSettingsFunction      | `{userId, settings}`                   |
| `settings/reset`             | Settings reset    | resetSettingsFunction       | `{userId}`                             |
| `support/request.created`    | Support ticket    | supportRequestCreated       | `{ticketId, userId}`                   |
| `feedback/submit`            | Feedback form     | processFeedbackSubmission   | `{code, rating, message}`              |
| `email/send`                 | Email trigger     | sendEmailHandler            | `{to, template, data}`                 |
| `cleanup/daily`              | Cron (3AM)        | dailyCleanup                | `{}`                                   |
| `email/weekly-feedback`      | Cron (Sunday)     | sendWeeklyFeedbackEmail     | `{}`                                   |

---

_This document provides detailed data flow visualizations for all major operations in the FairArena platform._
