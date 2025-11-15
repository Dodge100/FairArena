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

Note: Prometheus is not included in the Docker deploy. For metrics, use Render's built-in logging or deploy Prometheus separately.

## Environment Variables

```env
PORT=3000
ARCJET_KEY=your_arcjet_key_here
JWT_SECRET=your_jwt_secret_here
NODE_ENV=development
```

## Scripts

- `pnpm run dev` - Development server with hot reload
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
- ESLint + Prettier

## Git Hooks

- **Pre-commit**: Formats code, runs linting and type checking
- **Pre-push**: Builds both Backend and Frontend

## Development

The server runs on `http://localhost:3000` by default.

Hot reload is enabled - changes to `.ts` files will automatically restart the server.
