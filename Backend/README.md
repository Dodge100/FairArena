# FairArena Backend

Express API server with TypeScript, security middleware, and monitoring.

## Features

- 🔒 Arcjet security (rate limiting, bot detection, shield)
- 🛡️ Helmet, HPP, CORS protection
- 📊 Prometheus metrics endpoint
- ⚡ Hot reload with nodemon + tsx
- 📝 TypeScript with strict mode

## Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your values

# Start development server
pnpm run dev
```

## Environment Variables

```env
PORT=3000
ARCJET_KEY=your_arcjet_key_here
NODE_ENV=development
```

## Scripts

- `pnpm run dev` - Development server with hot reload
- `pnpm run build` - Compile TypeScript to JavaScript
- `pnpm run typecheck` - Type check without emitting
- `pnpm run start` - Run production build

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
│   ├── arcjet.ts          # Arcjet security config
│   └── env.ts             # Environment variables
├── middleware/
│   └── arcjet.middleware.ts  # Security middleware
└── index.ts               # Application entry point
```

## Security Features

- Rate limiting (60 requests/minute)
- Bot detection and blocking
- Shield protection against common attacks
- HTTP security headers (Helmet)
- HPP protection
- CORS configuration

## Tech Stack

- Express 5
- TypeScript 5.9
- Arcjet (Security)
- Prometheus (Metrics)
- Helmet, HPP, CORS

## Development

The server runs on `http://localhost:3000` by default.

Hot reload is enabled - changes to `.ts` files will automatically restart the server.
