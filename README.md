# FairArena

A modern, secure web application with React frontend and Express backend.

## Features

- 🔒 Security-first architecture with Arcjet protection
- ⚡ Fast development with Vite and TypeScript
- 📊 Prometheus metrics monitoring
- 🛡️ Rate limiting and bot detection
- 🎨 React 19 with modern tooling

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+

### Installation

```bash
# Clone the repository
git clone https://github.com/FairArena/FairArena.git
cd FairArena

# Install dependencies
cd Backend && pnpm install
cd ../Frontend && pnpm install
```

### Development

```bash
# Terminal 1 - Backend
cd Backend
cp .env.example .env.local
pnpm run dev

# Terminal 2 - Frontend
cd Frontend
cp .env.example .env.local
pnpm run dev
```

Backend runs on `http://localhost:3000`  
Frontend runs on `http://localhost:5173`

## Project Structure

```
FairArena/
├── Backend/          # Express API server
├── Frontend/         # React application
├── CONTRIBUTING.md   # Contribution guidelines
└── README.md         # This file
```

## Scripts

### Root

- `pnpm format` - Format all code with Prettier
- `pnpm format:check` - Check code formatting

### Backend

- `pnpm run dev` - Start development server
- `pnpm run build` - Build for production
- `pnpm run start` - Run production server
- `pnpm run lint` - Lint code with ESLint
- `pnpm run typecheck` - Type check without emitting

### Frontend

- `pnpm run dev` - Start development server
- `pnpm run build` - Build for production
- `pnpm run preview` - Preview production build
- `pnpm run lint` - Lint code with ESLint

## Tech Stack

**Frontend:**

- React 19
- TypeScript
- Vite
- ESLint + Prettier

**Backend:**

- Express 5
- TypeScript
- Arcjet (Security)
- Prometheus (Metrics)
- ESLint + Prettier

## Git Hooks

- **Pre-commit**: Formats code, runs linting and type checking on staged files
- **Pre-push**: Builds both Backend and Frontend to ensure production readiness

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

See [LICENSE](LICENSE) for details.
