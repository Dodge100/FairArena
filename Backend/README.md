# FairArena Backend

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.0+-black.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.0+-orange.svg)](https://www.prisma.io/)
[![Inngest](https://img.shields.io/badge/Inngest-3.0+-purple.svg)](https://www.inngest.com/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

Express API server with TypeScript, security middleware, and event-driven architecture.

## Features

- 🔒 **Arcjet Security**: Rate limiting, bot detection, DDoS protection
- 🛡️ **Security Headers**: Helmet, HPP, CORS protection
- 📊 **Monitoring**: Prometheus metrics with Grafana dashboards
- ⚡ **Hot Reload**: nodemon + tsx for development
- 🎯 **Event-Driven**: Inngest for reliable background processing
- 📝 **TypeScript**: Strict mode with full type safety
- 🐳 **Docker Ready**: Containerized deployment
- 🔄 **Database**: PostgreSQL with Prisma ORM

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your values

# Start development server
pnpm run dev

# In another terminal, start Inngest CLI
pnpm run dev:inngest
```

## Development Workflow

### 1. Start the Backend Server

```bash
pnpm run dev
```

Server runs on `http://localhost:3000`

### 2. Start Inngest CLI (in separate terminal)

```bash
pnpm run dev:inngest
```

This provides the local Inngest dashboard at `http://localhost:8288`

### 3. Access Services

- **API**: http://localhost:3000
- **Inngest Dashboard**: http://localhost:8288
- **Prometheus**: http://localhost:9090 (with Docker)
- **Grafana**: http://localhost:3001 (with Docker)

## Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL`: PostgreSQL connection string
- `CLERK_SECRET_KEY`: Clerk authentication
- `CLERK_WEBHOOK_SECRET`: Webhook signature verification
- `INNGEST_SIGNING_KEY`: Inngest function signing
- `INNGEST_EVENT_KEY`: Inngest event publishing
- `ARCJET_KEY`: Security service key

## Architecture

### Event-Driven User Sync

The backend uses Inngest for reliable event processing:

```
Clerk Webhook → Express Route → Inngest Event → Background Function → Database
```

#### Inngest Functions

- `userSync`: Handles `user.created` events
- `userUpdate`: Handles `user.updated` events

#### Webhook Security

- Svix signature verification
- Raw body parsing for signature validation
- Rate limiting (100 requests/15min per IP)

## Docker

### Start Backend and Prometheus

```bash
# Start the backend server and Prometheus monitoring
docker compose up -d

# Backend will be available at http://localhost:3000
# Prometheus will be available at http://localhost:9090
```

### Grafana Setup

Run Grafana using Docker:

```bash
docker run -d -p 3001:3000 --name=grafana grafana/grafana-oss
```

Grafana will be available at `http://localhost:3001` (default login: admin/admin).

### Run Backend Only (Dockerfile)

If you only want to run the backend without Prometheus:

```bash
# Build the Docker image
docker build -t backend .

# Run the container
docker run -p 3000:3000 --env-file .env backend
```

The backend will be available at `http://localhost:3000`. Note: Prometheus metrics will still be available at `/metrics`, but no external Prometheus server will be running.

## Deployment

### Deploy to Render

1. Sign up/login to [Render](https://render.com).
2. Create a new **Web Service** and connect your GitHub repository.
3. Choose **Docker** as the runtime.
4. Render will automatically build the Docker image using the `Dockerfile` (runs `docker build`) and start the container (runs `docker run` with the specified `CMD`).
5. Set the following environment variables in Render's dashboard:
   - `ARCJET_KEY`: Your Arcjet API key
   - `NODE_ENV`: `production`
   - Any other variables from your `.env` file
6. Deploy! Your app will be accessible at the URL provided by Render (e.g., `https://your-app.onrender.com`).

## Production Deployment

### Inngest Cloud Setup

For production, deploy functions to Inngest Cloud:

1. **Connect Repository**: Link your GitHub repo to Inngest Cloud
2. **Automatic Deployment**: Functions deploy automatically on git push
3. **Environment Variables**: Set production keys in Inngest dashboard
4. **Monitoring**: Use Inngest dashboard for function metrics

### Key Differences: Local vs Production

| Feature          | Local (CLI)     | Production (Cloud) |
| ---------------- | --------------- | ------------------ |
| **Availability** | Your machine    | 99.9% SLA          |
| **Scaling**      | Single instance | Auto-scaling       |
| **Persistence**  | Local only      | Durable storage    |
| **Monitoring**   | Basic logs      | Advanced metrics   |
| **Cost**         | Free            | Pay per execution  |

### Environment Variables for Production

Ensure these are set in your production environment:

```env
INNGEST_SIGNING_KEY=sign_your_prod_key
INNGEST_EVENT_KEY=event_your_prod_key
NODE_ENV=production
```

## Contributing

## Environment Variables

```env
PORT=3000
ARCJET_KEY=your_arcjet_key_here
JWT_SECRET=your_jwt_secret_here
NODE_ENV=development
```

## Scripts

- `pnpm run dev` - Development server with hot reload
- `pnpm run dev:inngest` - Start Inngest CLI for local development
- `pnpm run build` - Compile TypeScript to JavaScript
- `pnpm run typecheck` - Type check without emitting
- `pnpm run start` - Run production build
- `pnpm run lint` - Lint code with ESLint
- `pnpm run format` - Format code with Prettier
- `pnpm run format:check` - Check code formatting

## API Endpoints

### Health Check

```
GET /healthz
```

### Metrics

```
GET /metrics
```

Returns Prometheus metrics

## Project Structure

```
src/
├── config/
│   ├── arcjet.ts          # Arcjet security configuration
│   ├── database.ts        # Prisma database client
│   └── env.ts             # Environment variables validation
├── controllers/
│   └── webhookController.ts  # Clerk webhook handlers
├── inngest/
│   ├── client.ts          # Inngest client configuration
│   ├── functions.ts       # Legacy functions (deprecated)
│   ├── index.ts           # Function exports
│   ├── userOperations.ts  # Shared user operations
│   ├── userSync.ts        # User creation handler
│   └── userUpdate.ts      # User update handler
├── middleware/
│   └── arcjet.middleware.ts  # Security middleware
├── routes/
│   └── webhook.ts         # Webhook routes with signature verification
└── index.ts               # Application entry point
```

## Security Features

- Rate limiting (60 requests/minute)
- Bot detection and blocking
- Shield protection against common attacks
- HTTP security headers (Helmet)
- HPP protection
- CORS configuration

## Troubleshooting

### Inngest CLI Setup

The Inngest CLI provides a local development environment for testing functions:

```bash
# Install CLI globally (optional)
npm install -g inngest-cli

# Or run with npx
pnpm run dev:inngest
```

#### CLI Features

- **Local Dashboard**: http://localhost:8288
- **Function Testing**: Trigger and debug functions
- **Event Replay**: Re-run past events
- **Logs**: Real-time function execution logs

#### Configuration

The `inngest.json` file configures the CLI:

```json
{
  "functions": "src/inngest/index.ts",
  "serve": {
    "host": "localhost",
    "port": 3000,
    "url": "http://localhost:3000"
  },
  "app": "fairarena-backend"
}
```

#### Development Workflow

1. Start backend: `pnpm run dev`
2. Start Inngest CLI: `pnpm run dev:inngest`
3. Trigger webhooks or use dashboard to test functions
4. Check logs in both terminals

### Webhook Verification Fails

- Ensure `CLERK_WEBHOOK_SECRET` is set correctly
- Check webhook URL in Clerk dashboard: `https://yourdomain.com/webhooks/clerk`
- Verify Svix headers are being sent

### Database Connection Issues

```bash
# Test database connection
pnpm exec prisma db push

# Check database logs
docker logs fairarena-postgres
```

### Common Errors

- **"Headers already sent"**: Check for duplicate response sends in controllers
- **"Invalid webhook signature"**: Verify webhook secret matches Clerk dashboard
- **"Function not found"**: Ensure Inngest functions are properly exported

## Tech Stack

- Express 5
- TypeScript 5.9
- Arcjet (Security)
- Prometheus (Metrics)
- Helmet, HPP, CORS
- ESLint + Prettier

## Git Hooks

- **Pre-commit**: Formats code, runs linting and type checking
- **Pre-push**: Builds both Backend and Frontend

## Development

The server runs on `http://localhost:3000` by default.

Hot reload is enabled - changes to `.ts` files will automatically restart the server.
