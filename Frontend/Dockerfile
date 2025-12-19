FROM node:20-bullseye-slim

WORKDIR /app

# Set Node memory limit
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies WITHOUT running scripts
RUN pnpm install --ignore-scripts

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Expose port
EXPOSE 4173

# Start the app
CMD ["node", "dist/server.js"]
