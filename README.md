# FairArena

[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19+-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.0+-black.svg)](https://expressjs.com/)
[![Vite](https://img.shields.io/badge/Vite-6.0+-646cff.svg)](https://vitejs.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-6.0+-orange.svg)](https://www.prisma.io/)
[![Inngest](https://img.shields.io/badge/Inngest-3.0+-purple.svg)](https://www.inngest.com/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A modern, secure full-stack web application built with React 19, Express 5, and event-driven architecture. Features comprehensive security, monitoring, and scalable backend processing.

![FairArena Preview](./preview.png)

## ✨ Features

### 🔒 Security & Performance

- **Arcjet Protection**: Advanced rate limiting, bot detection, and DDoS protection
- **Clerk Authentication**: Secure user management with webhook integration
- **Event-Driven Architecture**: Reliable background processing with Inngest
- **Database Security**: PostgreSQL with Prisma ORM and connection pooling

### 🎨 Frontend

- **React 19**: Latest React features with modern hooks and concurrent rendering
- **TypeScript**: Full type safety and excellent developer experience
- **Vite**: Lightning-fast development server and optimized production builds
- **Modern Tooling**: ESLint, Prettier, and hot module replacement

### ⚙️ Backend

- **Express 5**: High-performance API server with TypeScript
- **Inngest Integration**: Event-driven user synchronization
- **Prometheus Metrics**: Comprehensive monitoring and alerting
- **Docker Ready**: Containerized deployment with multi-stage builds

### 📊 Monitoring & DevOps

- **Prometheus + Grafana**: Real-time metrics and visualization
- **Structured Logging**: JSON logs for better observability
- **Health Checks**: Automated service monitoring
- **Git Hooks**: Pre-commit formatting and validation

## 🚀 Quick Start

### Prerequisites

- **Node.js 22+** - [Download here](https://nodejs.org/)
- **pnpm 10+** - `npm install -g pnpm`
- **Git** - [Download here](https://git-scm.com/)

### Installation

```bash
# Clone the repository
git clone https://github.com/FairArena/FairArena.git
cd FairArena

# Install all dependencies
pnpm install

# Set up environment variables
cp Backend/.env.example Backend/.env
cp Frontend/.env.example Frontend/.env
# Edit the .env files with your configuration
```

### Development

```bash
# Terminal 1 - Backend + Inngest
cd Backend
pnpm run dev

# Terminal 2 - Inngest CLI (in another terminal)
cd Backend
pnpm run dev:inngest

# Terminal 3 - Frontend
cd Frontend
pnpm run dev
```

### Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Inngest Dashboard**: http://localhost:8288
- **Prometheus**: http://localhost:9090 (with Docker)
- **Grafana**: http://localhost:3001 (with Docker)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React 19      │    │   Express 5     │    │   PostgreSQL    │
│   Frontend      │◄──►│   Backend API   │◄──►│   Database      │
│                 │    │                 │    │                 │
│ • Vite          │    │ • Arcjet        │    │ • Prisma ORM    │
│ • TypeScript    │    │ • Clerk Auth    │    │ • Connection    │
│ • Hot Reload    │    │ • Inngest       │    │   Pooling       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              ▲
                              │
                       ┌─────────────────┐
                       │   Inngest       │
                       │   Functions     │
                       │                 │
                       │ • User Sync     │
                       │ • Event-Driven  │
                       │ • Auto-Retry    │
                       └─────────────────┘
```

### Event Flow

1. **User Registration** → Clerk Webhook → Inngest Event
2. **Background Processing** → User data synced to database
3. **Real-time Updates** → Frontend reflects changes instantly

## 📁 Project Structure

```
FairArena/
├── Backend/                    # Express API Server
│   ├── src/
│   │   ├── config/            # Configuration files
│   │   ├── controllers/       # Route controllers
│   │   ├── inngest/          # Event functions
│   │   ├── middleware/       # Express middleware
│   │   ├── routes/           # API routes
│   │   └── index.ts          # Server entry point
│   ├── prisma/               # Database schema
│   ├── docker-compose.yml    # Docker services
│   └── Dockerfile           # Container config
├── Frontend/                  # React Application
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/           # Custom hooks
│   │   ├── pages/           # Page components
│   │   └── App.tsx          # Main app component
│   ├── public/              # Static assets
│   └── vite.config.ts       # Vite configuration
├── .github/                  # GitHub Actions
├── docker-compose.yml        # Root Docker compose
└── package.json             # Workspace config
```

## 🛠️ Development Scripts

### Workspace (Root)

```bash
pnpm format          # Format all code
pnpm format:check    # Check formatting
pnpm lint           # Lint all projects
pnpm typecheck      # Type check all projects
```

### Backend Scripts

```bash
cd Backend
pnpm run dev              # Development server
pnpm run dev:inngest      # Inngest CLI
pnpm run build           # Production build
pnpm run start           # Production server
pnpm run lint            # ESLint
pnpm run typecheck       # TypeScript check
```

### Frontend Scripts

```bash
cd Frontend
pnpm run dev              # Development server
pnpm run build           # Production build
pnpm run preview         # Preview production
pnpm run lint            # ESLint
```

## 🐳 Docker Development

### Full Stack with Monitoring

```bash
# Start everything (Backend, Prometheus, Grafana)
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Individual Services

```bash
# Backend only
cd Backend && docker compose up -d

# Frontend only
cd Frontend && docker compose up -d
```

## 🚀 Production Deployment

### Backend (Recommended: Railway/Render)

```bash
cd Backend
# Deploy to Railway, Render, or similar
# Set environment variables in dashboard
```

### Frontend (Recommended: Vercel/Netlify)

```bash
cd Frontend
# Deploy to Vercel, Netlify, or similar
```

### Database (Recommended: Supabase/Neon)

- Managed PostgreSQL with automatic backups
- Connection pooling included
- Built-in monitoring

## 🔧 Configuration

### Environment Variables

#### Backend (.env)

```env
# Database
DATABASE_URL="postgresql://..."

# Clerk Authentication
CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
CLERK_WEBHOOK_SECRET="whsec_..."

# Inngest Events
INNGEST_SIGNING_KEY="sign_..."
INNGEST_EVENT_KEY="event_..."

# Security
ARCJET_KEY="arc_..."

# Production
NODE_ENV="production"
```

#### Frontend (.env)

```env
VITE_CLERK_PUBLISHABLE_KEY="pk_..."
VITE_API_BASE_URL="https://your-api.com"
```

## 📊 Monitoring

### Prometheus Metrics

- **Endpoint**: `/metrics`
- **Default Port**: 9090
- **Grafana**: Port 3001

### Key Metrics

- Request latency and throughput
- Error rates by endpoint
- Database connection pool status
- Inngest function execution times

## 🔒 Security Features

- **Rate Limiting**: 100 requests/15min per IP for webhooks
- **Bot Detection**: Arcjet shields against automated attacks
- **HTTPS Everywhere**: SSL/TLS encryption
- **CORS Protection**: Configured cross-origin policies
- **Input Validation**: TypeScript + runtime validation
- **SQL Injection Protection**: Prisma ORM safeguards

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Code Quality

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb config with React rules
- **Prettier**: Consistent code formatting
- **Pre-commit hooks**: Automatic formatting and validation

## 📝 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [React](https://reactjs.org/) - UI framework
- [Express](https://expressjs.com/) - Web framework
- [Inngest](https://www.inngest.com/) - Event-driven processing
- [Clerk](https://clerk.com/) - Authentication
- [Arcjet](https://arcjet.com/) - Security
- [Prisma](https://www.prisma.io/) - Database toolkit

---

**Built with ❤️ using modern web technologies**
