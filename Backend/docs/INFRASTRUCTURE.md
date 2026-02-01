# FairArena Infrastructure & Deployment Guide

> **Version:** 1.0.0
> **Environment:** Production (Azure)
> **Last Updated:** 2025-12-30

---

## Table of Contents

1. [Infrastructure Overview](#infrastructure-overview)
2. [Container Architecture](#container-architecture)
3. [Service Configuration](#service-configuration)
4. [Environment Variables](#environment-variables)
5. [Deployment Pipeline](#deployment-pipeline)
6. [Monitoring & Observability](#monitoring--observability)
7. [Security Configuration](#security-configuration)
8. [Scaling Strategy](#scaling-strategy)
9. [Disaster Recovery](#disaster-recovery)
10. [Runbooks](#runbooks)

---

## Infrastructure Overview

### Production Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#1e3a5f'}}}%%
flowchart TB
    subgraph INTERNET["Internet"]
        U["Users"]
    end

    subgraph CLOUDFLARE["Cloudflare"]
        CF_WAF["WAF"]
        CF_CDN["CDN"]
        CF_DNS["DNS"]
    end

    subgraph AZURE["Azure Cloud"]
        subgraph NETWORK["Virtual Network"]
            LB["Load Balancer"]
            CADDY["Caddy (Reverse Proxy)"]
        end

        subgraph COMPUTE["Container Instances"]
            BE["Backend"]
            INN["Inngest"]
            CV["Credential Validator"]
        end

        subgraph DATA["Data Services"]
            REDIS["Redis"]
            SRH["SRH (Redis HTTP)"]
        end

        subgraph MONITORING["Monitoring"]
            PROM["Prometheus"]
            CADV["cAdvisor"]
            OTEL["OTel Collector"]
        end

        subgraph MANAGED["Managed Services"]
            PG["PostgreSQL<br/>Flexible Server"]
            KV["Key Vault"]
            BLOB["Blob Storage"]
        end
    end

    subgraph EXTERNAL["External Services"]
        SIGNOZ["SigNoz Cloud"]
        CLERK["Clerk"]
        RAZORPAY["Razorpay"]
        RESEND["Resend"]
        GEMINI["Google Gemini"]
    end

    U --> CF_DNS --> CF_CDN --> CF_WAF
    CF_WAF --> LB --> CADDY
    CADDY --> BE
    BE --> INN
    BE --> CV
    BE --> REDIS
    REDIS --> SRH
    SRH --> BE
    BE --> PG
    BE --> KV

    PROM --> SIGNOZ
    CADV --> PROM
    OTEL --> SIGNOZ

    BE --> CLERK
    BE --> RAZORPAY
    BE --> RESEND
    BE --> GEMINI

    style INTERNET fill:#3b82f6,color:#fff
    style CLOUDFLARE fill:#f59e0b,color:#000
    style AZURE fill:#0078d4,color:#fff
    style EXTERNAL fill:#10b981,color:#fff
```

### Resource Inventory

| Resource | Provider | SKU/Tier | Purpose |
|----------|----------|----------|---------|
| DNS | Cloudflare | Pro | DNS + CDN + WAF |
| Container Instances | Azure | 2 vCPU, 4GB | Application hosting |
| PostgreSQL | Azure Flexible | Standard_D2ds_v5 | Primary database |
| PostgreSQL Read Replica | Azure Flexible | Standard_D2ds_v5 x2 | Read scaling |
| Key Vault | Azure | Standard | Secrets management |
| Blob Storage | Azure | Standard LRS | Static assets |
| Redis | Self-hosted | 7-alpine | Caching & queues |

---

## Container Architecture

### Docker Compose Services

```mermaid
%%{init: {'theme': 'base'}}%%
graph TB
    subgraph CORE["Core Services"]
        BE["backend<br/>Port: 3000"]
        INN["inngest<br/>Port: 8288"]
        CV["credential-validator<br/>Port: 3002"]
    end

    subgraph CACHE["Caching Layer"]
        REDIS["redis<br/>Port: 6379"]
        SRH["srh<br/>Port: 80"]
    end

    subgraph MONITOR["Monitoring"]
        PROM["prometheus<br/>Port: 9090"]
        CADV["cadvisor<br/>Port: 8080"]
        OTEL["otel-collector<br/>Port: 4318"]
        GOTEL["github-otel-collector"]
    end

    subgraph AUTOMATION["Automation"]
        N8N["n8n<br/>Port: 5678"]
    end

    SRH --> REDIS
    BE --> SRH
    INN --> REDIS
    BE -.->|healthcheck| SRH
    INN -.->|healthcheck| REDIS
    CADV --> PROM
    OTEL --> PROM

    style CORE fill:#3b82f6,color:#fff
    style CACHE fill:#10b981,color:#fff
    style MONITOR fill:#f59e0b,color:#000
    style AUTOMATION fill:#8b5cf6,color:#fff
```

### Service Dependencies

```yaml
# docker-compose.yml dependency chain
services:
  redis:
    # No dependencies - starts first

  srh:
    depends_on:
      redis:
        condition: service_healthy

  inngest:
    depends_on:
      redis:
        condition: service_healthy

  backend:
    depends_on:
      srh:
        condition: service_healthy
```

### Health Check Configuration

| Service | Endpoint | Interval | Timeout | Retries | Start Period |
|---------|----------|----------|---------|---------|--------------|
| Redis | `redis-cli ping` | 30s | 10s | 3 | 5s |
| SRH | `curl /redis/ping` | 30s | 10s | 3 | 60s |
| Inngest | `curl /health` | 30s | 10s | 3 | 120s |
| Backend | `curl /healthz` | 30s | 10s | 3 | 60s |
| Credential Validator | `curl /health` | 30s | 10s | 3 | 40s |
| Prometheus | `wget /-/healthy` | 30s | 10s | 3 | 30s |
| cAdvisor | `curl /healthz` | 30s | 10s | 3 | 30s |
| n8n | `curl /healthz` | 30s | 10s | 3 | 60s |

---

## Service Configuration

### Backend Service

```dockerfile
# Backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# Production runtime
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Redis Configuration

```yaml
# Redis service
redis:
  image: redis:7-alpine
  container_name: "Redis"
  restart: unless-stopped
  command: redis-server --appendonly yes --logfile /data/redis-server.log
  volumes:
    - redis-data:/data
  networks:
    - backend-net
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 5s
```

### Inngest Configuration

```yaml
# Inngest service
inngest:
  image: inngest/inngest:latest
  container_name: "Inngest"
  restart: unless-stopped
  ports:
    - "127.0.0.1:8288:8288"
  command:
    - sh
    - -c
    - |
      inngest start \
        --postgres-uri=$$DATABASE_URL \
        --redis-uri=$$INNGEST_REDIS_URL \
        --event-key=$$INNGEST_EVENT_KEY \
        --signing-key=$$INNGEST_SIGNING_KEY \
        --sdk-url=$$SERVE_URL \
        --port=8288
  env_file:
    - ./ShellScripts/.env.inngest
  depends_on:
    redis:
      condition: service_healthy
```

### OpenTelemetry Collector

```yaml
# OTel Collector configuration
receivers:
  docker_stats:
    endpoint: unix:///var/run/docker.sock
    collection_interval: 10s
  filelog/redis:
    include: [/var/log/redis/redis-server.log]
    operators:
      - type: regex_parser
        regex: '^(?P<timestamp>\d+:\w+)\s+(?P<level>\*|#)\s+(?P<message>.*)$'
  redis:
    endpoint: redis:6379
    collection_interval: 10s

processors:
  batch:
    timeout: 10s
    send_batch_size: 512
  resource:
    attributes:
      - key: service.name
        value: fairarena-redis
        action: upsert

exporters:
  otlphttp:
    endpoint: ${SIGNOZ_ENDPOINT}
    headers:
      signoz-ingestion-key: ${SIGNOZ_INGESTION_KEY}

service:
  pipelines:
    metrics:
      receivers: [redis, docker_stats]
      processors: [batch, resource]
      exporters: [otlphttp]
    logs:
      receivers: [filelog/redis]
      processors: [batch]
      exporters: [otlphttp]
```

---

## Environment Variables

### Backend Environment (.env)

```bash
# Server
PORT=3000
NODE_ENV=production
CORS_URL=www.fairarena.app

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
DATABASE_URL_READ_ONLY_1=postgresql://user:pass@read1:5432/db
DATABASE_URL_READ_ONLY_2=postgresql://user:pass@read2:5432/db

# Authentication
CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx

# Cache
UPSTASH_REDIS_REST_URL=http://srh:80
UPSTASH_REDIS_REST_TOKEN=xxx

# Background Jobs
INNGEST_SIGNING_KEY=signkey-xxx
INNGEST_EVENT_KEY=xxx
INNGEST_BASE_URL=http://inngest:8288

# Email
RESEND_API_KEY=re_xxx
FROM_EMAIL_ADDRESS=noreply@noreply.fairarena.app

# Payments
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
PAYMENTS_ENABLED=true

# AI
GOOGLE_GEMINI_API_KEY=xxx
LANGCHAIN_API_KEY=xxx
LANGCHAIN_PROJECT=fairarena-ai
LANGCHAIN_TRACING_V2=true

# Security
JWT_SECRET=xxx
ARCJET_KEY=xxx
HEALTHZ_HEADER_NAME=X-Health-Check
HEALTHZ_HEADER_VALUE=xxx

# Azure
AZURE_KEY_VAULT_URL=https://fairarena-kv.vault.azure.net/

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.signoz.io:443
SIGNOZ_INGESTION_KEY=xxx
OTEL_SERVICE_NAME=fairarena-backend
```

### Inngest Environment (.env.inngest)

```bash
DATABASE_URL=postgresql://user:pass@host:5432/inngest
INNGEST_REDIS_URL=redis://redis:6379
INNGEST_EVENT_KEY=xxx
INNGEST_SIGNING_KEY=signkey-xxx
SERVE_URL=http://backend:3000/api/inngest
```

### SRH Environment (.env.srh)

```bash
SRH_MODE=env
SRH_TOKEN=xxx
SRH_CONNECTION_STRING=redis://redis:6379
```

---

## Deployment Pipeline

### CI/CD Flow

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart LR
    subgraph DEV["Development"]
        C["Code Push"]
        PR["Pull Request"]
    end

    subgraph CI["CI Pipeline"]
        L["Lint"]
        T["Tests"]
        B["Build"]
        S["Security Scan"]
    end

    subgraph CD["CD Pipeline"]
        I["Build Image"]
        P["Push to Registry"]
        D["Deploy to Staging"]
        V["Validate"]
        PROD["Deploy to Production"]
    end

    C --> PR --> L --> T --> B --> S
    S --> I --> P --> D --> V --> PROD

    style DEV fill:#3b82f6,color:#fff
    style CI fill:#10b981,color:#fff
    style CD fill:#8b5cf6,color:#fff
```

### Deployment Script

```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 Starting deployment..."

# Generate environment files
cd Backend && bash ShellScripts/envs.sh && cd ..
cd Frontend && bash ShellScripts/envs.sh && cd ..

# Pull latest images
docker compose pull

# Build custom images
docker compose build --no-cache

# Deploy with zero-downtime
docker compose up -d --remove-orphans

# Wait for health checks
echo "⏳ Waiting for services to be healthy..."
docker compose ps

# Verify deployment
curl -f -H "${HEALTHZ_HEADER_NAME}: ${HEALTHZ_HEADER_VALUE}" \
  http://localhost:3000/healthz || exit 1

echo "✅ Deployment complete!"
```

### Rollback Procedure

```bash
#!/bin/bash
# rollback.sh

set -e

PREVIOUS_TAG=${1:-"latest-1"}

echo "⚠️  Rolling back to ${PREVIOUS_TAG}..."

# Stop current version
docker compose stop backend

# Update to previous version
docker compose pull backend:${PREVIOUS_TAG}
docker compose up -d backend

# Verify rollback
curl -f http://localhost:3000/healthz || {
  echo "❌ Rollback failed!"
  exit 1
}

echo "✅ Rollback complete!"
```

---

## Monitoring & Observability

### Metrics Collection

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart TB
    subgraph SOURCES["Metric Sources"]
        BE["Backend<br/>/metrics"]
        REDIS["Redis Exporter"]
        DOCKER["cAdvisor"]
        NODE["Node Exporter"]
    end

    subgraph COLLECT["Collection"]
        PROM["Prometheus<br/>Scrape Targets"]
    end

    subgraph EXPORT["Export"]
        OTEL["OTel Collector"]
    end

    subgraph VISUALIZE["Visualization"]
        SIGNOZ["SigNoz<br/>Dashboards & Alerts"]
    end

    BE --> PROM
    REDIS --> PROM
    DOCKER --> PROM
    NODE --> PROM
    PROM --> OTEL
    OTEL --> SIGNOZ

    style SOURCES fill:#3b82f6,color:#fff
    style COLLECT fill:#10b981,color:#fff
    style EXPORT fill:#f59e0b,color:#000
    style VISUALIZE fill:#8b5cf6,color:#fff
```

### Prometheus Configuration

```yaml
# prometheus-config.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: /metrics
    scheme: http

  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

### Key Metrics

| Metric | Type | Alert Threshold | Description |
|--------|------|-----------------|-------------|
| `http_request_duration_seconds_p99` | Histogram | > 2s | Request latency |
| `http_requests_total{status="5xx"}` | Counter | > 10/min | Error rate |
| `nodejs_heap_size_used_bytes` | Gauge | > 80% of max | Memory usage |
| `pg_stat_activity_count` | Gauge | > 80% of max | DB connections |
| `redis_connected_clients` | Gauge | > 100 | Redis connections |
| `inngest_function_runs_failed_total` | Counter | > 5/min | Background job failures |

### Alerting Rules

```yaml
groups:
  - name: fairarena-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: HighLatency
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P99 latency above 2 seconds"

      - alert: HighMemoryUsage
        expr: nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Memory usage above 85%"

      - alert: DatabaseConnectionsHigh
        expr: pg_stat_activity_count > 40
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connections above 80%"
```

---

## Security Configuration

### Network Security

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart TB
    subgraph PUBLIC["Public Internet"]
        USER["Users"]
    end

    subgraph DMZ["DMZ"]
        CF["Cloudflare"]
        CADDY["Caddy"]
    end

    subgraph PRIVATE["Private Network (backend-net)"]
        BE["Backend :3000"]
        INN["Inngest :8288"]
        REDIS["Redis :6379"]
        CV["Credential Validator :3002"]
    end

    subgraph ISOLATED["Managed Services"]
        PG["PostgreSQL"]
        KV["Key Vault"]
    end

    USER --> CF --> CADDY
    CADDY --> BE
    BE <--> INN
    BE <--> REDIS
    BE <--> CV
    BE --> PG
    BE --> KV

    style PUBLIC fill:#ef4444,color:#fff
    style DMZ fill:#f59e0b,color:#000
    style PRIVATE fill:#10b981,color:#fff
    style ISOLATED fill:#3b82f6,color:#fff
```

### Port Exposure

| Service | Container Port | Host Binding | Accessible From |
|---------|---------------|--------------|-----------------|
| Backend | 3000 | 127.0.0.1:3000 | Caddy only |
| Inngest | 8288 | 127.0.0.1:8288 | Internal only |
| Credential Validator | 3002 | 127.0.0.1:3002 | Internal only |
| Redis | 6379 | None | Container network |
| Prometheus | 9090 | 127.0.0.1:9090 | Internal only |
| cAdvisor | 8080 | 127.0.0.1:8080 | Internal only |
| n8n | 5678 | 0.0.0.0:5678 | Authenticated access |

### Secrets Management

```mermaid
%%{init: {'theme': 'base'}}%%
sequenceDiagram
    participant APP as Application
    participant ENV as Environment
    participant KV as Azure Key Vault
    participant DB as Database

    Note over APP,DB: Startup Secret Loading
    APP->>ENV: Read AZURE_KEY_VAULT_URL
    APP->>KV: List secrets (Managed Identity)
    KV-->>APP: Secret values
    APP->>APP: Load into ENV object

    Note over APP,DB: Fallback Path
    APP->>DB: Query EnvironmentVariable table
    DB-->>APP: Cached secrets
```

---

## Scaling Strategy

### Horizontal Scaling

```mermaid
%%{init: {'theme': 'base'}}%%
graph TB
    subgraph LB["Load Balancer"]
        HA["Health-aware<br/>Round Robin"]
    end

    subgraph BACKEND["Backend Instances"]
        B1["Backend 1"]
        B2["Backend 2"]
        B3["Backend 3"]
    end

    subgraph SHARED["Shared State"]
        REDIS["Redis"]
        PG["PostgreSQL"]
    end

    HA --> B1 & B2 & B3
    B1 & B2 & B3 --> REDIS
    B1 & B2 & B3 --> PG
```

### Scaling Triggers

| Metric | Scale Up | Scale Down | Cooldown |
|--------|----------|------------|----------|
| CPU | > 70% for 5min | < 30% for 10min | 5 min |
| Memory | > 80% for 5min | < 40% for 10min | 5 min |
| Request Rate | > 100 req/s | < 20 req/s | 5 min |
| Latency P99 | > 1s for 5min | < 200ms for 10min | 10 min |

### Resource Limits

```yaml
# Recommended container resources
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1G

  redis:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.25'
          memory: 512M

  inngest:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.25'
          memory: 512M
```

---

## Disaster Recovery

### Backup Strategy

| Component | Backup Type | Frequency | Retention | RTO | RPO |
|-----------|-------------|-----------|-----------|-----|-----|
| PostgreSQL | Continuous WAL | Streaming | 35 days | 5 min | 0 min |
| PostgreSQL | Full snapshot | Daily 2AM | 30 days | 30 min | 24 hrs |
| Redis | RDB + AOF | 1 min / continuous | 24 hrs | 2 min | 1 min |
| Key Vault | Versioned | Automatic | 90 days | Instant | 0 |
| Container Images | Registry | Each deploy | 30 versions | Instant | 0 |

### Failover Procedures

```mermaid
%%{init: {'theme': 'base'}}%%
stateDiagram-v2
    [*] --> Normal: All systems operational

    Normal --> DBFailure: Primary DB fails
    DBFailure --> PromoteReplica: Auto-failover
    PromoteReplica --> Normal: Recovery complete

    Normal --> BackendFailure: Backend crash
    BackendFailure --> Restart: Auto-restart
    Restart --> Normal: Recovery complete

    Normal --> RedisFailure: Redis crash
    RedisFailure --> RedisRestart: Auto-restart
    RedisRestart --> CacheWarm: Warm cache
    CacheWarm --> Normal: Recovery complete
```

### Recovery Procedures

**Database Failover:**

```bash
# Automatic with Azure PostgreSQL Flexible Server
# Manual intervention:
az postgres flexible-server replica promote \
  --resource-group fairarena-rg \
  --name fairarena-db-replica-1
```

**Application Recovery:**

```bash
# Force restart all services
docker compose down
docker compose up -d

# Check status
docker compose ps
docker compose logs --tail=100
```

---

## Runbooks

### High CPU Alert

```markdown
## Runbook: High CPU Usage

### Symptoms
- Alert: CPU usage > 70% for 5 minutes
- Slow response times
- Request timeouts

### Investigation Steps
1. Check which container is consuming CPU:
   ```bash
   docker stats --no-stream
   ```

2. Check for spike in traffic:
   ```bash
   curl localhost:9090/api/v1/query?query=rate(http_requests_total[5m])
   ```

3. Check for long-running queries:
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE state != 'idle'
   ORDER BY duration DESC;
   ```

### Resolution
1. If traffic spike: Scale up instances
2. If slow query: Optimize or kill query
3. If memory leak: Restart container
```

### Database Connection Exhaustion

```markdown
## Runbook: Database Connection Exhaustion

### Symptoms
- Error: "too many connections"
- Requests timing out
- Database unavailable

### Investigation Steps
1. Check current connections:
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
   ```

2. Identify connection hogs:
   ```sql
   SELECT client_addr, count(*)
   FROM pg_stat_activity
   GROUP BY client_addr
   ORDER BY count DESC;
   ```

### Resolution
1. Kill idle connections:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle'
   AND query_start < now() - interval '1 hour';
   ```

2. Restart backend to reset connection pool:
   ```bash
   docker compose restart backend
   ```

3. If persistent: Increase max_connections in PostgreSQL
```

### Payment Webhook Failures

```markdown
## Runbook: Payment Webhook Processing Failures

### Symptoms
- Payments complete but credits not added
- PaymentWebhookEvent with processed=false
- Customer complaints

### Investigation Steps
1. Check failed webhooks:
   ```sql
   SELECT * FROM "PaymentWebhookEvent"
   WHERE processed = false
   ORDER BY "createdAt" DESC
   LIMIT 20;
   ```

2. Check Inngest dashboard for failed functions:
   - URL: http://localhost:8288

3. Check backend logs:
   ```bash
   docker compose logs backend | grep "webhook"
   ```

### Resolution
1. Retry failed webhooks via Inngest UI

2. Manual credit adjustment:
   ```sql
   INSERT INTO "CreditTransaction" (
     id, "userId", "paymentId", amount, balance, type, description
   ) SELECT
     gen_random_uuid(),
     p."userId",
     p.id,
     p.credits,
     COALESCE((
       SELECT balance FROM "CreditTransaction"
       WHERE "userId" = p."userId"
       ORDER BY "createdAt" DESC LIMIT 1
     ), 0) + p.credits,
     'PURCHASE',
     'Manual adjustment - webhook failure'
   FROM "Payment" p WHERE p.id = 'payment_id_here';
   ```
```

---

## Appendix: Commands Reference

### Docker Commands

```bash
# View all containers
docker compose ps -a

# View logs
docker compose logs -f backend
docker compose logs --tail=100 redis

# Restart service
docker compose restart backend

# Scale service
docker compose up -d --scale backend=3

# Execute command in container
docker compose exec backend sh
docker compose exec redis redis-cli

# View resource usage
docker stats --no-stream
```

### Database Commands

```bash
# Connect to database
docker compose exec backend npx prisma studio

# Run migrations
docker compose exec backend npx prisma migrate deploy

# Generate Prisma client
docker compose exec backend npx prisma generate
```

### Debugging Commands

```bash
# Check network
docker network inspect fairarena_backend-net

# Check volumes
docker volume ls

# Clear cache
docker compose exec backend node -e "
  const { redis } = require('./dist/config/redis.js');
  redis.flushdb().then(() => console.log('Cache cleared'));
"

# Test health check
curl -H "X-Health-Check: ${HEALTHZ_HEADER_VALUE}" http://localhost:3000/healthz
```

---

*This document provides comprehensive infrastructure and deployment documentation for the FairArena platform.*
