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
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4173
CMD ["nginx", "-g", "daemon off;"]
