FROM node:20-bullseye-slim AS builder

WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy deps only (max caching)
COPY package*.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --prod=false

# Copy source
COPY . .

# Skip tsc, use Vite only (faster, less memory)
RUN pnpm vite build

# Nginx production
FROM nginx:alpine

ARG TRIVY_VERSION=0.69.1

# Install Trivy for in-container scans
RUN wget -qO /tmp/trivy.tar.gz "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz" \
    && tar -xzf /tmp/trivy.tar.gz -C /tmp \
    && mv /tmp/trivy /usr/local/bin/trivy \
    && rm -rf /tmp/trivy.tar.gz
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4173
CMD ["nginx", "-g", "daemon off;"]
