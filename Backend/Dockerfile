FROM dhi.io/node:23-alpine3.21-dev

WORKDIR /app

ARG TRIVY_VERSION=0.69.1

# Set Node memory limit
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy dependency files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install pnpm globally
# Install pnpm globally (force path)
RUN npm install -g pnpm --prefix /usr/local

# Install Trivy for in-container scans
RUN wget -qO /tmp/trivy.tar.gz "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz" \
	&& tar -xzf /tmp/trivy.tar.gz -C /tmp \
	&& mv /tmp/trivy /usr/local/bin/trivy \
	&& rm -rf /tmp/trivy.tar.gz

# Install dependencies WITHOUT running scripts (to avoid postinstall error)
RUN pnpm install --ignore-scripts

# Copy source code
COPY . .

# Generate Prisma client manually
# Use dummy URL for build if not provided (avoids crash when secrets aren't available during build)
ARG DATABASE_URL
RUN DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres} npx prisma generate

# Build the application
RUN pnpm run build

# Expose port
EXPOSE 3000

# Start the app
CMD ["node", "dist/index.js"]
