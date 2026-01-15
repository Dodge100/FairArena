<p align="center">
  <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" alt="FairArena Logo" width="120" height="120">
</p>

<h1 align="center">FairArena Backend</h1>

<p align="center">
  <strong>Production-grade REST API powering the FairArena platform</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#documentation">Documentation</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20_LTS-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/Prisma-7.2-2D3748?logo=prisma&logoColor=white" alt="Prisma">
  <img src="https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white" alt="Redis">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/OpenTelemetry-Enabled-7B36ED?logo=opentelemetry&logoColor=white" alt="OpenTelemetry">
  <img src="https://img.shields.io/badge/License-Proprietary-red.svg" alt="License">
</p>

---

## 📖 Table of Contents

- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [API Reference](#-api-reference)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Configuration](#-configuration)
- [Scripts](#-scripts)
- [Deployment](#-deployment)
- [Documentation](#-documentation)
- [Author](#-author)

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 20 LTS+ | JavaScript runtime |
| pnpm | 8.x+ | Package manager |
| PostgreSQL | 15+ | Primary database |
| Redis | 7+ | Caching & rate limiting |

### Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your configuration (see Configuration section)

# 3. Set up database
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
pnpm db:seed          # (Optional) Seed with sample data

# 4. Start development servers
pnpm dev              # API Server → http://localhost:3000
pnpm dev:inngest      # Background Jobs → http://localhost:8288
```

### Docker Development

```bash
# From project root
docker compose up -d

# Verify services
curl http://localhost:3000/healthz
docker compose logs -f backend
```

### Development URLs

| Service | URL | Description |
|---------|-----|-------------|
| 🌐 **API Server** | http://localhost:3000 | Main REST API |
| 📖 **Swagger Docs** | http://localhost:3000/api-docs | Interactive API documentation |
| ⚡ **Inngest Dashboard** | http://localhost:8288 | Background job monitoring |
| 📊 **Prometheus** | http://localhost:9090 | Metrics dashboard |
| 🗄️ **Prisma Studio** | http://localhost:5555 | Database GUI (`pnpm db:studio`) |

---

## 🏗 Architecture

<p align="center">
  <img src="https://fairarena.blob.core.windows.net/fairarena/FairArena-Design.png" alt="FairArena System Architecture" width="100%">
</p>

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FairArena Backend                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   Cloudflare │───▶│    Caddy     │───▶│   Express    │                  │
│  │   WAF + CDN  │    │    Proxy     │    │    Server    │                  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘                  │
│                                                  │                          │
│         ┌───────────────────┬───────────────────┼───────────────────┐      │
│         ▼                   ▼                   ▼                   ▼      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐ │
│  │   Inngest    │    │    Redis     │    │  PostgreSQL  │    │ External │ │
│  │   (Events)   │    │   (Cache)    │    │  (Primary +  │    │   APIs   │ │
│  │              │    │              │    │   Replicas)  │    │          │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Highlights

| Metric | Target | Description |
|--------|--------|-------------|
| **Availability** | 99.9% | Health checks + auto-recovery |
| **P99 Latency** | <200ms | Redis caching + read replicas |
| **Throughput** | 1000 req/min | Arcjet rate limiting |
| **Background Jobs** | 34+ functions | Event-driven with Inngest |

---

## 📡 API Reference

### Base URLs

| Environment | URL |
|-------------|-----|
| **Production** | `https://fairarena.sakshamg.me/api/v1` |
| **Development** | `http://localhost:3000/api/v1` |

### Authentication

All authenticated endpoints require a Clerk JWT token:

```http
Authorization: Bearer <clerk_jwt_token>
```

### Endpoint Summary

| Category | Endpoints | Auth | Description |
|----------|:---------:|:----:|-------------|
| **Profile** | 5 | ✅ | User profile management |
| **Credits** | 8 | ✅ | Credit balance & OTP verification |
| **Account Settings** | 5 | ✅ | Email verification, data export |
| **Organizations** | 8 | ✅ | Organization CRUD & management |
| **Teams** | 7 | ✅ | Team management |
| **Team Invitations** | 7 | Mixed | Invite flow (accept/decline public) |
| **AI Assistant** | 3 | ✅ | Streaming & non-streaming chat |
| **Notifications** | 8 | ✅ | Real-time notification system |
| **Stars** | 4 | Mixed | Profile starring |
| **Payments** | 3 | ✅ | Razorpay integration |
| **Plans** | 2 | ❌ | Public pricing plans |
| **Settings** | 3 | ✅ | User preferences |
| **Reports** | 2 | ✅ | Content reporting |
| **Feedback** | 2 | ❌ | Public feedback submission |
| **Newsletter** | 2 | ❌ | Email subscriptions |
| **Support** | 2 | Mixed | Support tickets |
| **Health** | 1 | ❌ | Service health check |
| | **70+** | | **Total Endpoints** |

### Postman Collection

Complete API testing collection available in `postman/`:

```bash
# Files included:
postman/
├── FairArena_API.postman_collection.json     # 70+ endpoints with examples
├── FairArena_API.postman_environment.json    # Development variables
├── FairArena_API_Production.postman_environment.json
└── README.md                                  # Complete endpoint reference
```

**Quick Setup:**

1. Import `FairArena_API.postman_collection.json` in Postman
2. Import appropriate environment file
3. Set `clerkToken` from browser cookies (`__session`)

---

## 🛠 Technology Stack

### Core Technologies

| Layer | Technology | Version | Purpose |
|-------|------------|:-------:|---------|
| **Runtime** | Node.js | 20 LTS | JavaScript runtime |
| **Language** | TypeScript | 5.9 | Type-safe development |
| **Framework** | Express | 5.2 | HTTP server |
| **ORM** | Prisma | 7.2 | Database access |
| **Database** | PostgreSQL | 15+ | Primary data store |
| **Cache** | Redis (Upstash) | 7 | Caching & rate limits |

### Integrations

| Service | Technology | Purpose |
|---------|------------|---------|
| **Authentication** | Clerk | JWT-based auth with webhooks |
| **Background Jobs** | Inngest | Event-driven job processing |
| **Payments** | Razorpay | Payment gateway (INR) |
| **Email** | Resend | Transactional emails |
| **AI** | Google Gemini + LangChain | AI assistant with tools |
| **Security** | Arcjet + Helmet | Rate limiting & headers |
| **Observability** | OpenTelemetry + SigNoz | Tracing & metrics |

---

## 📁 Project Structure

```
Backend/
├── 📂 docs/                      # Comprehensive documentation
│   ├── SYSTEM_ARCHITECTURE.md   # Architecture diagrams
│   ├── DATA_FLOW.md             # Request lifecycle
│   ├── API_REFERENCE.md         # Full API docs
│   ├── DATABASE_DESIGN.md       # Schema & ERD
│   └── INFRASTRUCTURE.md        # Deployment guide
│
├── 📂 postman/                   # API testing
│   ├── FairArena_API.postman_collection.json
│   └── README.md
│
├── 📂 prisma/                    # Database
│   ├── schema.prisma            # Database schema (30+ models)
│   ├── migrations/              # Migration history
│   └── seed.ts                  # Seed data
│
└── 📂 src/
    ├── 📂 config/               # Configuration
    │   ├── arcjet.ts            # Rate limiting
    │   ├── database.ts          # Prisma client
    │   ├── env.ts               # Environment validation (Zod)
    │   ├── razorpay.ts          # Payment config
    │   ├── redis.ts             # Cache config
    │   └── swagger.ts           # OpenAPI config
    │
    ├── 📂 controllers/v1/       # Request handlers
    │   ├── organization/        # 8 org controllers
    │   ├── team/                # 7 team controllers
    │   ├── creditsController.ts
    │   ├── paymentsController.ts
    │   └── ... (15+ controllers)
    │
    ├── 📂 email/                # Email system
    │   └── templates/           # 19 React Email templates
    │
    ├── 📂 inngest/v1/           # Background jobs
    │   ├── client.ts            # Inngest client config
    │   ├── payment-webhook.ts   # Payment processing
    │   ├── userSync.ts          # Clerk user sync
    │   └── ... (34+ functions)
    │
    ├── 📂 middleware/           # Express middleware
    │   ├── arcjet.middleware.ts
    │   ├── auth.middleware.ts
    │   ├── organizationPermissions.middleware.ts
    │   └── team-permission.middleware.ts
    │
    ├── 📂 routes/v1/            # API routes (17 modules)
    ├── 📂 services/v1/          # Business logic
    ├── 📂 utils/                # Utilities
    │
    ├── index.ts                 # Application entry
    ├── instrument.ts            # OpenTelemetry setup
    └── tracing.ts               # Tracing configuration
```

---

## ⚙ Configuration

### Required Environment Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `DATABASE_URL` | [Neon](https://neon.tech) / [Supabase](https://supabase.com) | PostgreSQL connection |
| `CLERK_SECRET_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) | Auth secret (`sk_...`) |
| `CLERK_WEBHOOK_SECRET` | Clerk Dashboard | Webhook verification |
| `INNGEST_SIGNING_KEY` | [Inngest Dashboard](https://app.inngest.com) | Function signing |
| `INNGEST_EVENT_KEY` | Inngest Dashboard | Event publishing |
| `UPSTASH_REDIS_REST_URL` | [Upstash Console](https://console.upstash.com) | Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Console | Redis auth |
| `RESEND_API_KEY` | [Resend Dashboard](https://resend.com) | Email service (`re_...`) |
| `RAZORPAY_KEY_ID` | [Razorpay Dashboard](https://dashboard.razorpay.com) | Payment key (`rzp_...`) |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard | Payment secret |
| `GOOGLE_GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com) | AI service |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `MAINTENANCE_MODE` | `false` | Enable maintenance page |
| `PAYMENTS_ENABLED` | `false` | Enable payment processing |
| `CREDENTIAL_VALIDATOR_URL` | - | Phone validation service |

---

## 📜 Scripts

### Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with hot reload |
| `pnpm dev:inngest` | Start Inngest local dev server |
| `pnpm build` | Compile TypeScript |
| `pnpm start` | Run production build |

### Code Quality

| Command | Description |
|---------|-------------|
| `pnpm typecheck` | Type check without emit |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format with Prettier |
| `pnpm format:check` | Check formatting |

### Database

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run migrations |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:seed` | Seed database |
| `pnpm db:reset` | Reset database (⚠️ destructive) |

### Utilities

| Command | Description |
|---------|-------------|
| `pnpm script:clear-redis` | Clear Redis cache |
| `pnpm script:sync-env-to-db` | Sync env vars to database |

---

## 🚢 Deployment

### Docker Build

```bash
# Build image
docker build -t fairarena-backend .

# Run container
docker run -p 3000:3000 --env-file .env fairarena-backend
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure secrets via Azure Key Vault
- [ ] Enable database read replicas
- [ ] Configure Inngest Cloud keys
- [ ] Enable Arcjet production mode
- [ ] Set `PAYMENTS_ENABLED=true`
- [ ] Configure SigNoz for observability
- [ ] Set up Cloudflare WAF rules
- [ ] Verify health check endpoint

### Health Check

```bash
curl -H "X-Health-Check: ${HEALTHZ_HEADER_VALUE}" \
  https://fairarena.sakshamg.me/healthz
```

---

## 📚 Documentation

Comprehensive documentation available in `docs/`:

| Document | Description |
|----------|-------------|
| [📐 **System Architecture**](./docs/SYSTEM_ARCHITECTURE.md) | Complete architecture with Mermaid diagrams |
| [🔄 **Data Flow**](./docs/DATA_FLOW.md) | Request lifecycle, workflows, state machines |
| [📡 **API Reference**](./docs/API_REFERENCE.md) | Full endpoint documentation with examples |
| [💾 **Database Design**](./docs/DATABASE_DESIGN.md) | Schema, ERD, indexing, retention policies |
| [⚙️ **Infrastructure**](./docs/INFRASTRUCTURE.md) | Deployment, Docker, monitoring, runbooks |

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔐 **JWT Authentication** | Clerk-based auth with role-based access control |
| 💳 **Payment Processing** | Razorpay integration with webhook handling |
| 🤖 **AI Assistant** | Google Gemini with 10 context-aware tools |
| ⚡ **Event-Driven** | 34+ Inngest background functions |
| 📧 **Email System** | 19 React Email templates via Resend |
| 🗄️ **Read Replicas** | Horizontal read scaling (2 replicas) |
| 🚀 **Redis Caching** | TTL-based caching for performance |
| 📊 **Observability** | Prometheus metrics + OpenTelemetry tracing |
| 🛡️ **Security** | Arcjet rate limiting + Helmet headers |
| 🔔 **Notifications** | Real-time notification system |

---

## 👤 Author

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/Saksham-Goel1107">
        <img src="https://github.com/Saksham-Goel1107.png" width="100px;" alt=""/>
        <br />
        <sub><b>Saksham Goel</b></sub>
      </a>
      <br />
      <a href="https://www.sakshamg.me">🌐 Website</a> •
      <a href="https://github.com/Saksham-Goel1107">GitHub</a>
    </td>
  </tr>
</table>

---

## 📄 License

This project is licensed under the **Proprietary License** — see the [LICENSE](../LICENSE) file for details.

---

<p align="center">
  <a href="https://fair.sakshamg.me">🌐 Website</a> •
  <a href="https://github.com/fairarena">💻 GitHub</a> •
  <a href="mailto:fairarena.contact@gmail.com">📧 Support</a>
</p>

<p align="center">
  <sub>Built with ❤️ by the FairArena Team</sub>
</p>
