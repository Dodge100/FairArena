FROM node:20-bullseye-slim

WORKDIR /app

# Set Node memory limit
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy dependency files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies WITHOUT running scripts (to avoid postinstall error)
RUN pnpm install --ignore-scripts

# Copy source code
COPY . .

# Generate Prisma client manually
RUN npx prisma generate

# Build the application
RUN pnpm run build

# Expose port
EXPOSE 3000

# Start the app
CMD ["node", "dist/index.js"]
