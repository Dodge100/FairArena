import { getActiveModelsList } from '../../config/ai-gateway-models.js';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { redis } from '../../config/redis.js';
import { ModelStatus } from '../../generated/client.js';
import logger from '../../utils/logger.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModelStatusValue = 'operational' | 'degraded' | 'outage' | 'unknown';

export interface Incident {
  id?: string;
  startedAt: string;
  resolvedAt?: string | null;
  errorMessage: string;
  provider: string;
}

export interface ModelStatusEntry {
  modelId: string;
  displayName: string;
  provider: string;
  category: string;
  status: ModelStatusValue;
  latencyMs: number | null;
  checkedAt: string | null;
  uptimePercent: number;
  errorMessage?: string | null;
  activeIncident?: Incident;
  supportsVision: boolean;
  supportsToolCalling: boolean;
  metrics?: {
    p50: number | null;
    p95: number | null;
    min: number | null;
    max: number | null;
  };
}

// ─── Redis keys ───────────────────────────────────────────────────────────────

const CACHE_KEY = 'ai-gateway:status:snapshot:v2';
const CACHE_TTL_SECS = 120; // 2 min
const PROBE_TIMEOUT_MS = 12_000;
const DEGRADED_THRESHOLD_MS = 5_000;

// ─── Provider probe configs ───────────────────────────────────────────────────

const PROVIDERS = ['groq', 'gemini', 'openrouter', 'cloudflare'] as const;
type Provider = (typeof PROVIDERS)[number];

const PROBE_CONFIGS: Record<
  Provider,
  { model: string; endpoint: 'groq' | 'gemini' | 'openrouter' | 'cloudflare' }
> = {
  // Use smallest/fastest models for probes to minimise latency & quota usage
  groq: { model: 'llama-3.3-70b-versatile', endpoint: 'groq' },
  gemini: { model: 'gemini-2.5-flash-lite', endpoint: 'gemini' },
  openrouter: { model: 'mistralai/mistral-small-3.1-24b-instruct:free', endpoint: 'openrouter' },
  cloudflare: { model: '@cf/meta/llama-3.2-1b-instruct', endpoint: 'cloudflare' },
};

const PROBE_MESSAGES = [{ role: 'user', content: 'Respond with the word: ok' }];

// ─── Utility: Map DB Enum to App Value ────────────────────────────────────────

function mapStatusToApp(dbStatus: ModelStatus): ModelStatusValue {
  switch (dbStatus) {
    case ModelStatus.OPERATIONAL:
      return 'operational';
    case ModelStatus.DEGRADED:
      return 'degraded';
    case ModelStatus.OUTAGE:
      return 'outage';
    case ModelStatus.UNKNOWN:
      return 'unknown';
    default:
      return 'unknown';
  }
}

function mapAppToDbStatus(status: ModelStatusValue): ModelStatus {
  switch (status) {
    case 'operational':
      return ModelStatus.OPERATIONAL;
    case 'degraded':
      return ModelStatus.DEGRADED;
    case 'outage':
      return ModelStatus.OUTAGE;
    case 'unknown':
      return ModelStatus.UNKNOWN;
    default:
      return ModelStatus.UNKNOWN;
  }
}

// ─── Probers ──────────────────────────────────────────────────────────────────

async function runProbe(
  provider: Provider,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const cfg = PROBE_CONFIGS[provider];
  const start = Date.now();

  try {
    let res: Response;
    if (provider === 'groq') {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ENV.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: PROBE_MESSAGES,
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
    } else if (provider === 'gemini') {
      const modelId = cfg.model.startsWith('models/') ? cfg.model : `models/${cfg.model}`;
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${ENV.GOOGLE_GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Respond with the word: ok' }] }],
            generationConfig: { maxOutputTokens: 5, temperature: 0 },
          }),
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        },
      );
    } else if (provider === 'cloudflare') {
      const cfToken = ENV.CLOUDFLARE_API_TOKEN;
      const cfAccId = ENV.CLOUDFLARE_ACCOUNT_ID;
      if (!cfToken || !cfAccId) {
        return {
          ok: false,
          latencyMs: Date.now() - start,
          error: 'Cloudflare credentials not configured',
        };
      }
      res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccId}/ai/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: cfg.model,
            messages: PROBE_MESSAGES,
            max_tokens: 5,
          }),
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        },
      );
    } else {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ENV.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://fairarena.app',
          'X-Title': 'FairArena Status Monitor',
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: PROBE_MESSAGES,
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
    }

    const latencyMs = Date.now() - start;
    if (!res.ok) {
      if ((provider === 'openrouter' || provider === 'cloudflare') && res.status === 429) {
        return { ok: true, latencyMs }; // Treat 429 as success for monitoring
      }
      return { ok: false, latencyMs, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    return { ok: true, latencyMs };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: (err as Error).name === 'TimeoutError' ? 'Timeout' : (err as Error).message,
    };
  }
}

// ─── Periodic Task ────────────────────────────────────────────────────────────

// ─── Periodic Task ────────────────────────────────────────────────────────────

export async function runStatusProbes(): Promise<void> {
  logger.info('Reliability: Starting parallel model health probes');
  const now = new Date();
  const allModels = getActiveModelsList();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    // 1. Run all probes in parallel
    const results = await Promise.all(
      PROVIDERS.map(async (p) => ({ provider: p, result: await runProbe(p) })),
    );

    // 2. Fetch all history counts for all models at once to calculate uptime
    const historyCounts = await prisma.aiModelHistory.groupBy({
      by: ['modelId', 'ok'],
      where: { createdAt: { gte: since24h } },
      _count: true,
    });

    // 3. Manage incidents and update status for each provider
    for (const { provider, result } of results) {
      const providerModels = allModels.filter((m) => m.provider === provider);

      // Log History for all models of this provider
      await prisma.aiModelHistory.createMany({
        data: providerModels.map((m) => ({
          modelId: m.modelId,
          ok: result.ok,
          latencyMs: result.latencyMs,
          error: result.error,
          createdAt: now,
        })),
      });

      // Manage Incidents
      const activeIncident = await prisma.aiModelIncident.findFirst({
        where: { provider, resolvedAt: null },
      });

      if (!result.ok && !activeIncident) {
        await prisma.aiModelIncident.create({
          data: { provider, errorMessage: result.error ?? 'Unknown error', startedAt: now },
        });
        logger.warn(`Reliability: Detected incident for ${provider}`, { error: result.error });
      } else if (result.ok && activeIncident) {
        await prisma.aiModelIncident.update({
          where: { id: activeIncident.id },
          data: { resolvedAt: now },
        });
        logger.info(`Reliability: Resolved incident for ${provider}`);
      }

      // Update individual model status snapshots
      for (const m of providerModels) {
        // Calculate uptime from the bulk-fetched counts
        const modelCounts = historyCounts.filter((h) => h.modelId === m.modelId);
        const total = modelCounts.reduce((acc, c) => acc + c._count, 0) + 1; // +1 for the new one
        const okCount = (modelCounts.find((c) => c.ok)?._count ?? 0) + (result.ok ? 1 : 0);
        const uptimePercent = Math.round((okCount / total) * 100);

        const appStatus: ModelStatusValue = result.ok
          ? result.latencyMs > DEGRADED_THRESHOLD_MS
            ? 'degraded'
            : 'operational'
          : 'outage';

        await prisma.aiModelStatus.upsert({
          where: { modelId: m.modelId },
          update: {
            status: mapAppToDbStatus(appStatus),
            latencyMs: result.latencyMs,
            uptimePercent,
            lastCheckedAt: now,
            errorMessage: result.ok ? null : result.error,
          },
          create: {
            modelId: m.modelId,
            displayName: m.displayName,
            provider: m.provider,
            category: m.category,
            status: mapAppToDbStatus(appStatus),
            latencyMs: result.latencyMs,
            uptimePercent,
            lastCheckedAt: now,
            errorMessage: result.ok ? null : result.error,
          },
        });
      }
    }

    await redis.del(CACHE_KEY);
    logger.info('Reliability: Probes complete, cache invalidated');
  } catch (err) {
    logger.error('Reliability: Critical failure in runStatusProbes', {
      error: (err as Error).message,
    });
  }
}

export interface ModelStatusSnapshot {
  success: boolean;
  data: {
    models: ModelStatusEntry[];
    probeRanAt: string | null;
    incidentHistory: Incident[];
  };
}

// ─── Read Access ──────────────────────────────────────────────────────────────

export async function getModelStatus(): Promise<ModelStatusSnapshot> {
  const cached = await redis.get<string | ModelStatusSnapshot>(CACHE_KEY);
  if (cached) {
    if (typeof cached === 'string') {
      try {
        return JSON.parse(cached) as ModelStatusSnapshot;
      } catch {}
    } else if (typeof cached === 'object' && cached !== null && 'data' in cached) {
      return cached as ModelStatusSnapshot;
    }
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [statuses, incidents, allHistory] = await Promise.all([
    prisma.aiModelStatus.findMany(),
    prisma.aiModelIncident.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }),
    prisma.aiModelHistory.findMany({
      where: { ok: true, createdAt: { gte: since24h } },
      select: { modelId: true, latencyMs: true },
    }),
  ]);

  const allModels = getActiveModelsList();
  const models: ModelStatusEntry[] = allModels.map((m) => {
    const dbStatus = statuses.find((s) => s.modelId === m.modelId);

    // Efficiently get latency metrics from pre-loaded history
    const lats = allHistory
      .filter((h) => h.modelId === m.modelId)
      .map((h) => h.latencyMs!)
      .filter((l) => l > 0)
      .sort((a, b) => a - b);

    const metrics =
      lats.length > 0
        ? {
            min: lats[0],
            max: lats[lats.length - 1],
            p50: lats[Math.floor(lats.length * 0.5)],
            p95: lats[Math.floor(lats.length * 0.95)],
          }
        : undefined;

    return {
      modelId: m.modelId,
      displayName: m.displayName,
      provider: m.provider,
      category: m.category,
      status: dbStatus ? mapStatusToApp(dbStatus.status) : 'unknown',
      latencyMs: dbStatus?.latencyMs ?? null,
      checkedAt: dbStatus?.lastCheckedAt?.toISOString() ?? null,
      uptimePercent: dbStatus?.uptimePercent ?? 0,
      errorMessage: dbStatus?.errorMessage,
      supportsVision: m.supportsVision,
      supportsToolCalling: m.supportsToolCalling,
      metrics,
    };
  });

  const snapshot = {
    success: true,
    data: {
      models,
      probeRanAt:
        statuses.length > 0
          ? ([...statuses]
              .filter((s) => s.lastCheckedAt)
              .sort(
                (a, b) => (b.lastCheckedAt?.getTime() || 0) - (a.lastCheckedAt?.getTime() || 0),
              )[0]
              ?.lastCheckedAt?.toISOString() ?? null)
          : null,
      incidentHistory: incidents.map((i) => ({
        id: i.id,
        provider: i.provider,
        startedAt: i.startedAt.toISOString(),
        resolvedAt: i.resolvedAt?.toISOString(),
        errorMessage: i.errorMessage,
      })),
    },
  };

  await redis.setex(CACHE_KEY, CACHE_TTL_SECS, JSON.stringify(snapshot));
  return snapshot;
}
