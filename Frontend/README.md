# FairArena Frontend

Modern React application built with Vite and TypeScript.

## Features

- ⚡ Vite for lightning-fast HMR
- ⚛️ React 19 with latest features
- 📝 TypeScript with strict mode
- 🎨 ESLint for code quality
- 🔥 Hot module replacement

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
VITE_API_BASE_URL=http://localhost:3000
```

## Scripts

- `pnpm run dev` - Start development server
- `pnpm run build` - Build for production
- `pnpm run preview` - Preview production build
- `pnpm run lint` - Run ESLint

## Project Structure

```
src/
├── assets/          # Static assets
├── components/      # React components
├── App.tsx          # Root component
└── main.tsx         # Application entry point
```

## Development

The app runs on `http://localhost:5173` by default.

Hot module replacement is enabled - changes are reflected instantly without full page reload.

## Building for Production

```bash
pnpm run build
```

Output is in the `dist/` directory.

## Tech Stack

- React 19
- TypeScript 5.9
- Vite 7
- ESLint 9

## Browser Support

Modern browsers with ES2020+ support.
