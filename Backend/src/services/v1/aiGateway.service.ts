/**
 * AI Gateway Service

 * Handles routing, caching, streaming, and credit deduction
 * for all supported AI provider backends (Groq, Gemini, OpenRouter).
 */
import crypto from 'crypto';
import { Response } from 'express';
import { calculateCredits, getModelConfig, ModelConfig } from '../../config/ai-gateway-models.js';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { deductUserCredits, getUserCreditBalance } from './creditService.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ChatMessageContent[];
  name?: string;
  tool_call_id?: string;
}

export interface ChatMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'auto' | 'low' | 'high' };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface AiGatewayRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  tools?: ToolDefinition[];
  tool_choice?: string | Record<string, unknown>;
  user?: string;
  // FairArena-specific
  cache?: boolean; // enable response caching (default: true for non-streaming)
  cache_ttl?: number; // cache TTL in seconds (default: 300)
}

export interface AiGatewayResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: {
    index: number;
    message: { role: string; content: string; tool_calls?: unknown[] };
    finish_reason: string;
    logprobs: null;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  // FairArena-specific
  x_fairarena?: {
    credits_used: number;
    cached: boolean;
    latency_ms: number;
    model_info: {
      provider: string;
      context_window: number;
    };
  };
}

export interface GatewayCallContext {
  userId: string;
  apiKeyId?: string;
  ipAddress?: string;
  userAgent?: string;
}

const RESPONSE_CACHE_TTL = 300; // 5 minutes default
const RATE_LIMIT_WINDOW = 60; // 1 minute window
const RATE_LIMIT_MAX = 60; // 60 requests per minute per user

// ─── Tool-Calling Fallback ─────────────────────────────────────────────────────
//
// When a model doesn't natively support tool/function calling we:
//   1. Inject a system prompt that teaches the model the tool schemas.
//   2. Ask it to respond with JSON inside <tool_call> ... </tool_call> blocks.
//   3. Parse the response and reconstruct an OpenAI-compatible tool_calls array.
//
// If the model returns plain text (no tool call block), we surface it as a
// normal assistant message — so callers never receive a crash.

const TOOL_FALLBACK_SYSTEM_INFIX = `
You have access to the following tools. When you decide to use a tool, respond ONLY with a JSON object inside exactly one pair of XML tags, like this:
<tool_call>
{"name": "<tool_name>", "arguments": {<arguments_as_json>}}
</tool_call>
If you do not need to use a tool, respond normally as text. Never add any text before or after the <tool_call> block when you are invoking a tool.

Available tools:
`;

/**
 * Build a modified request that emulates tool calling for models that lack it.
 * Returns a new request where:
 *  - tools/tool_choice are stripped
 *  - a system message describing the tools is prepended
 */
function buildFallbackRequest(request: AiGatewayRequest): AiGatewayRequest {
  if (!request.tools?.length) return request;

  const schema = request.tools
    .map(
      (t) =>
        `- **${t.function.name}**: ${t.function.description ?? '(no description)'}\n  Parameters: ${JSON.stringify(t.function.parameters, null, 2)}`,
    )
    .join('\n\n');

  const toolSystemMsg: ChatMessage = {
    role: 'system',
    content: `${TOOL_FALLBACK_INFIX}${schema}`,
  };

  // Prepend to messages (or merge with existing system message)
  const existingSystem = request.messages.find((m) => m.role === 'system');
  let messages: ChatMessage[];
  if (existingSystem) {
    messages = request.messages.map((m) =>
      m.role === 'system'
        ? {
            ...m,
            content: `${TOOL_FALLBACK_INFIX}${schema}\n\n${typeof m.content === 'string' ? m.content : ''}`,
          }
        : m,
    );
  } else {
    messages = [toolSystemMsg, ...request.messages];
  }

  return { ...request, messages, tools: undefined, tool_choice: undefined };
}

const TOOL_FALLBACK_INFIX = TOOL_FALLBACK_SYSTEM_INFIX;

/**
 * Normalize messages for providers that only support string content (non-vision models).
 * If a message has a content array, it collapses it into a string.
 */
function normalizeMessages(messages: ChatMessage[], supportsVision: boolean): ChatMessage[] {
  if (supportsVision) return messages;

  return messages.map((m) => {
    if (typeof m.content === 'string') return m;
    const text = m.content
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('\n');
    return { ...m, content: text };
  });
}
function parseFallbackToolCall(response: AiGatewayResponse): AiGatewayResponse {
  const text = response.choices?.[0]?.message?.content;
  if (typeof text !== 'string') return response;

  const match = text.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/);
  if (!match) return response; // Plain text response — leave as-is

  try {
    const parsed = JSON.parse(match[1]) as { name: string; arguments: Record<string, unknown> };
    return {
      ...response,
      choices: response.choices.map((c, i) =>
        i === 0
          ? {
              ...c,
              message: {
                role: 'assistant',
                content: '',
                tool_calls: [
                  {
                    id: `call_${Date.now()}`,
                    type: 'function',
                    function: {
                      name: parsed.name,
                      arguments: JSON.stringify(parsed.arguments),
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            }
          : c,
      ),
    };
  } catch {
    // JSON parse failed — surface as plain text
    return response;
  }
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

export async function checkRateLimit(
  userId: string,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `${REDIS_KEYS.AI_GW_RATE_LIMIT}${userId}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - RATE_LIMIT_WINDOW;

  try {
    // Use Redis sorted set to track requests in sliding window
    await redis.zremrangebyscore(key, 0, windowStart);
    const count = await redis.zcard(key);

    if (count >= RATE_LIMIT_MAX) {
      const oldest = await redis.zrange(key, 0, 0, { withScores: true });
      const resetAt =
        oldest.length >= 2
          ? Math.ceil(Number(oldest[1]) + RATE_LIMIT_WINDOW)
          : now + RATE_LIMIT_WINDOW;
      return { allowed: false, remaining: 0, resetAt };
    }

    // Record this request
    await redis.zadd(key, {
      score: now,
      member: `${now}:${crypto.randomBytes(4).toString('hex')}`,
    });
    await redis.expire(key, RATE_LIMIT_WINDOW * 2);

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - count - 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    };
  } catch (err) {
    logger.warn('AI Gateway rate limit check failed, allowing request', {
      userId,
      error: (err as Error).message,
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX, resetAt: now + RATE_LIMIT_WINDOW };
  }
}

// ─── Response Caching ─────────────────────────────────────────────────────────

function buildCacheKey(request: AiGatewayRequest): string {
  const payload = {
    model: request.model,
    messages: request.messages,
    temperature: request.temperature ?? 1,
    max_tokens: request.max_tokens,
    top_p: request.top_p ?? 1,
    tools: request.tools,
    tool_choice: request.tool_choice,
  };
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .substring(0, 32);
  return `${REDIS_KEYS.AI_GW_RESPONSE_CACHE}${hash}`;
}

async function getCachedResponse(cacheKey: string): Promise<AiGatewayResponse | null> {
  try {
    const cached = await redis.get<string>(cacheKey);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return parsed as AiGatewayResponse;
    }
  } catch (err) {
    logger.warn('AI Gateway cache read failed', { error: (err as Error).message });
  }
  return null;
}

async function setCachedResponse(
  cacheKey: string,
  response: AiGatewayResponse,
  ttl: number,
): Promise<void> {
  try {
    await redis.setex(cacheKey, ttl, JSON.stringify(response));
  } catch (err) {
    logger.warn('AI Gateway cache write failed', { error: (err as Error).message });
  }
}

// ─── Provider: Groq ──────────────────────────────────────────────────────────

async function callGroq(
  model: ModelConfig,
  request: AiGatewayRequest,
  streaming: boolean,
): Promise<ReadableStream | AiGatewayResponse> {
  const groqKey = ENV.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY not configured');

  const normalizedMessages = normalizeMessages(request.messages, !!model.supportsVision);

  const body: Record<string, unknown> = {
    model: model.providerModelId,
    messages: normalizedMessages,
    stream: streaming,
    temperature: request.temperature ?? 1,
    max_tokens: Math.min(request.max_tokens ?? model.maxOutputTokens, model.maxOutputTokens),
    top_p: request.top_p ?? 1,
    stream_options: streaming ? { include_usage: true } : undefined,
  };

  if (request.frequency_penalty !== undefined) body.frequency_penalty = request.frequency_penalty;
  if (request.presence_penalty !== undefined) body.presence_penalty = request.presence_penalty;
  if (request.stop) body.stop = request.stop;
  if (request.tools && model.supportsToolCalling) {
    body.tools = request.tools;
    if (request.tool_choice) body.tool_choice = request.tool_choice;
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const errMsg = (err as { error?: { message?: string } }).error?.message ?? res.statusText;
    throw new ProviderError(`Groq error: ${errMsg}`, res.status);
  }

  if (streaming) {
    return res.body as ReadableStream;
  }

  const data = (await res.json()) as AiGatewayResponse;
  return data;
}

// ─── Provider: Gemini ─────────────────────────────────────────────────────────

function convertToGeminiMessages(messages: ChatMessage[]): {
  systemInstruction?: { parts: { text: string }[] };
  contents: unknown[];
} {
  let systemInstruction: { parts: { text: string }[] } | undefined;
  const contents: unknown[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = {
        parts: [
          {
            text:
              typeof msg.content === 'string'
                ? msg.content
                : msg.content.map((p) => p.text ?? '').join(''),
          },
        ],
      };
      continue;
    }

    const role = msg.role === 'assistant' ? 'model' : 'user';
    let parts: unknown[];

    if (typeof msg.content === 'string') {
      parts = [{ text: msg.content }];
    } else {
      parts = msg.content.map((p) => {
        if (p.type === 'text') return { text: p.text };
        if (p.type === 'image_url' && p.image_url?.url) {
          // Gemini expects base64 inline data or GCS URIs
          const url = p.image_url.url;
          if (url.startsWith('data:')) {
            const [header, data] = url.split(',');
            const mimeType = header.replace('data:', '').replace(';base64', '');
            return { inlineData: { mimeType, data } };
          }
          return { fileData: { fileUri: url, mimeType: 'image/jpeg' } };
        }
        return { text: '' };
      });
    }

    contents.push({ role, parts });
  }

  return { systemInstruction, contents };
}

async function callGemini(
  model: ModelConfig,
  request: AiGatewayRequest,
  streaming: boolean,
): Promise<ReadableStream | AiGatewayResponse> {
  const geminiKey = ENV.GOOGLE_GEMINI_API_KEY;
  if (!geminiKey) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

  const { systemInstruction, contents } = convertToGeminiMessages(request.messages);

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: request.temperature ?? 1,
      maxOutputTokens: Math.min(request.max_tokens ?? model.maxOutputTokens, model.maxOutputTokens),
      topP: request.top_p ?? 1,
      stopSequences: request.stop
        ? Array.isArray(request.stop)
          ? request.stop
          : [request.stop]
        : undefined,
    },
  };

  if (systemInstruction) body.systemInstruction = systemInstruction;

  if (request.tools && model.supportsToolCalling) {
    body.tools = [
      {
        functionDeclarations: request.tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      },
    ];
  }

  const action = streaming ? 'streamGenerateContent' : 'generateContent';
  const altParam = streaming ? 'alt=sse&' : '';
  const modelPath = model.providerModelId.startsWith('models/')
    ? model.providerModelId
    : `models/${model.providerModelId}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:${action}?${altParam}key=${geminiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const errMsg = (err as { error?: { message?: string } }).error?.message ?? res.statusText;
    throw new ProviderError(`Gemini error: ${errMsg}`, res.status);
  }

  if (streaming) {
    // Return a transformed SSE stream in OpenAI format
    return transformGeminiStream(
      res.body as ReadableStream,
      model.modelId,
    ) as unknown as ReadableStream;
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
  const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

  return {
    id: `chatcmpl-gemini-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model.modelId,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: candidate?.finishReason?.toLowerCase() ?? 'stop',
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

/**
 * Transform Gemini SSE stream to OpenAI SSE format
 */
async function* transformGeminiStream(
  stream: ReadableStream,
  modelId: string,
): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const geminiChunk = JSON.parse(jsonStr) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> };
              finishReason?: string;
            }>;
          };
          const candidate = geminiChunk.candidates?.[0];
          const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
          const finishReason = candidate?.finishReason?.toLowerCase();

          const openAiChunk = {
            id: `chatcmpl-gemini-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: modelId,
            choices: [
              {
                index: 0,
                delta: { content: text },
                finish_reason: finishReason === 'stop' ? 'stop' : null,
                logprobs: null,
              },
            ],
          };

          yield encoder.encode(`data: ${JSON.stringify(openAiChunk)}\n\n`);
        } catch {
          // Skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield encoder.encode('data: [DONE]\n\n');
}

// ─── Provider: OpenRouter ─────────────────────────────────────────────────────

async function callOpenRouter(
  model: ModelConfig,
  request: AiGatewayRequest,
  streaming: boolean,
): Promise<ReadableStream | AiGatewayResponse> {
  const orKey = ENV.OPENROUTER_API_KEY;
  if (!orKey) throw new Error('OPENROUTER_API_KEY not configured');

  const normalizedMessages = normalizeMessages(request.messages, !!model.supportsVision);

  const body: Record<string, unknown> = {
    model: model.providerModelId,
    messages: normalizedMessages,
    stream: streaming,
    temperature: request.temperature ?? 1,
    max_tokens: Math.min(request.max_tokens ?? model.maxOutputTokens, model.maxOutputTokens),
    top_p: request.top_p ?? 1,
    stream_options: streaming ? { include_usage: true } : undefined,
  };

  if (request.frequency_penalty !== undefined) body.frequency_penalty = request.frequency_penalty;
  if (request.presence_penalty !== undefined) body.presence_penalty = request.presence_penalty;
  if (request.stop) body.stop = request.stop;
  if (request.tools && model.supportsToolCalling) {
    body.tools = request.tools;
    if (request.tool_choice) body.tool_choice = request.tool_choice;
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${orKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://fairarena.vercel.app',
      'X-Title': 'FairArena AI Gateway',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const errMsg = (err as { error?: { message?: string } }).error?.message ?? res.statusText;
    throw new ProviderError(`OpenRouter error: ${errMsg}`, res.status);
  }

  if (streaming) {
    return res.body as ReadableStream;
  }

  const data = (await res.json()) as AiGatewayResponse;
  data.model = model.modelId;
  return data;
}

// ─── Provider: Cloudflare Workers AI ────────────────────────────────────────

async function callCloudflare(
  model: ModelConfig,
  request: AiGatewayRequest,
  streaming: boolean,
): Promise<ReadableStream | AiGatewayResponse> {
  const cfToken = ENV.CLOUDFLARE_API_TOKEN;
  const cfAccId = ENV.CLOUDFLARE_ACCOUNT_ID;
  if (!cfToken || !cfAccId) throw new ProviderError('Cloudflare credentials not configured', 500);

  const normalizedMessages = normalizeMessages(request.messages, !!model.supportsVision);

  // Standard Chat Completion
  const body: Record<string, unknown> = {
    model: model.providerModelId,
    messages: normalizedMessages,
    stream: streaming,
    temperature: request.temperature ?? 1,
    max_tokens:
      Math.min(request.max_tokens ?? model.maxOutputTokens, model.maxOutputTokens) || 2048,
    stream_options: streaming ? { include_usage: true } : undefined,
  };
  if (request.tools && model.supportsToolCalling) {
    body.tools = request.tools;
    if (request.tool_choice) body.tool_choice = request.tool_choice;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccId}/ai/v1/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const errMsg = (err as { error?: { message?: string } }).error?.message ?? res.statusText;
    throw new ProviderError(`Cloudflare error: ${errMsg}`, res.status);
  }

  if (streaming) return res.body as ReadableStream;

  const data = (await res.json()) as AiGatewayResponse;
  data.model = model.modelId;
  return data;
}

// ─── Provider Error ───────────────────────────────────────────────────────────

export class ProviderError extends Error {
  public status: number;
  public statusCode: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.statusCode = status;
  }
}

// ─── Log Usage ────────────────────────────────────────────────────────────────

async function logUsage(params: {
  userId: string;
  apiKeyId?: string;
  model: ModelConfig;
  promptTokens: number;
  completionTokens: number;
  creditsUsed: number;
  latencyMs: number;
  streaming: boolean;
  cached: boolean;
  status: 'SUCCESS' | 'ERROR' | 'RATE_LIMITED' | 'INSUFFICIENT_CREDITS';
  errorCode?: string;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.aiGatewayRequest.create({
      data: {
        userId: params.userId,
        apiKeyId: params.apiKeyId,
        model: params.model.modelId,
        provider: params.model.provider,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        totalTokens: params.promptTokens + params.completionTokens,
        creditsUsed: params.creditsUsed,
        latencyMs: params.latencyMs,
        streaming: params.streaming,
        cached: params.cached,
        status: params.status as 'SUCCESS' | 'ERROR' | 'RATE_LIMITED' | 'INSUFFICIENT_CREDITS',
        errorCode: params.errorCode,
        errorMessage: params.errorMessage?.substring(0, 500),
        ipAddress: params.ipAddress,
        userAgent: params.userAgent?.substring(0, 256),
        requestMetadata: {
          provider: params.model.provider,
          providerModelId: params.model.providerModelId,
        },
      },
    });
  } catch (err) {
    const errMsg = (err as Error).message ?? '';
    // Silently skip if the table hasn't been migrated yet
    if (
      errMsg.includes('does not exist') ||
      errMsg.includes('relation') ||
      errMsg.includes('AiGatewayRequest')
    ) {
      return;
    }
    logger.warn('AI Gateway: failed to log usage', { error: errMsg });
  }
}

// ─── Main Gateway Function ────────────────────────────────────────────────────

export async function processAiGatewayRequest(
  request: AiGatewayRequest,
  context: GatewayCallContext,
  res?: Response,
): Promise<AiGatewayResponse | void> {
  const startTime = Date.now();
  const streaming = request.stream === true && !request.cache;
  const enableCache = request.cache !== false && !streaming;
  const cacheTtl = Math.min(request.cache_ttl ?? RESPONSE_CACHE_TTL, 3600);

  // 1. Resolve model config
  const modelConfig = getModelConfig(request.model);
  if (!modelConfig) {
    throw new ProviderError(
      `Model '${request.model}' not found. Call /v1/models to see available models.`,
      404,
    );
  }
  if (!modelConfig.isActive) {
    throw new ProviderError(`Model '${request.model}' is currently unavailable.`, 503);
  }

  // 2. Rate limit check
  const rateLimit = await checkRateLimit(context.userId);
  if (!rateLimit.allowed) {
    await logUsage({
      userId: context.userId,
      apiKeyId: context.apiKeyId,
      model: modelConfig,
      promptTokens: 0,
      completionTokens: 0,
      creditsUsed: 0,
      latencyMs: Date.now() - startTime,
      streaming: false,
      cached: false,
      status: 'RATE_LIMITED',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw new ProviderError('Rate limit exceeded. Max 60 requests per minute.', 429);
  }

  // 3. Estimate credit cost upfront (use rough estimate)
  const estimatedInputTokens = Math.ceil(
    request.messages.reduce((sum, m) => {
      const content =
        typeof m.content === 'string' ? m.content : m.content.map((p) => p.text ?? '').join('');
      return sum + content.length / 4; // ~4 chars per token estimate
    }, 0),
  );
  const estimatedCredits = calculateCredits(
    modelConfig,
    estimatedInputTokens,
    modelConfig.maxOutputTokens / 2,
  );

  // 4. Credit check (skip for free models)
  if (modelConfig.inputCreditsPerK > 0 || modelConfig.outputCreditsPerK > 0) {
    const balance = await getUserCreditBalance(context.userId);
    // Require at least 10 credits buffer or estimated usage
    const minRequired = Math.max(1, Math.min(estimatedCredits, 50));
    if (balance < minRequired) {
      await logUsage({
        userId: context.userId,
        apiKeyId: context.apiKeyId,
        model: modelConfig,
        promptTokens: 0,
        completionTokens: 0,
        creditsUsed: 0,
        latencyMs: Date.now() - startTime,
        streaming: false,
        cached: false,
        status: 'INSUFFICIENT_CREDITS',
        errorCode: 'INSUFFICIENT_CREDITS',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      throw new ProviderError(
        `Insufficient credits. You have ${balance} credits, need at least ${minRequired}.`,
        402,
      );
    }
  }

  // 5. Check cache for non-streaming requests
  let cacheKey: string | null = null;
  if (enableCache) {
    cacheKey = buildCacheKey(request);
    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      logger.info('AI Gateway: cache hit', { userId: context.userId, model: request.model });
      cached.x_fairarena = {
        ...(cached.x_fairarena ?? {
          credits_used: 0,
          cached: true,
          latency_ms: 0,
          model_info: { provider: modelConfig.provider, context_window: modelConfig.contextWindow },
        }),
        cached: true,
        latency_ms: Date.now() - startTime,
      };
      // Log usage for cached responses (no credit charge)
      await logUsage({
        userId: context.userId,
        apiKeyId: context.apiKeyId,
        model: modelConfig,
        promptTokens: cached.usage.prompt_tokens,
        completionTokens: cached.usage.completion_tokens,
        creditsUsed: 0,
        latencyMs: Date.now() - startTime,
        streaming: false,
        cached: true,
        status: 'SUCCESS',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return cached;
    }
  }

  // 6. Apply tool-call fallback if model lacks native support
  //    - Transform the request so tools are described in the system prompt
  //    - Force non-streaming so we can parse the JSON response
  const needsFallback = !!(request.tools?.length && !modelConfig.supportsToolCalling);
  const effectiveRequest = needsFallback ? buildFallbackRequest(request) : request;
  // Streaming tool-call emulation is unreliable — downgrade to non-streaming for fallback
  const effectiveStreaming = needsFallback ? false : streaming;

  // 7. Call provider
  let providerResponse: ReadableStream | AiGatewayResponse;
  try {
    switch (modelConfig.provider) {
      case 'groq':
        providerResponse = await callGroq(modelConfig, effectiveRequest, effectiveStreaming);
        break;
      case 'gemini':
        providerResponse = await callGemini(modelConfig, effectiveRequest, effectiveStreaming);
        break;
      case 'openrouter':
        providerResponse = await callOpenRouter(modelConfig, effectiveRequest, effectiveStreaming);
        break;
      case 'cloudflare':
        providerResponse = await callCloudflare(modelConfig, effectiveRequest, effectiveStreaming);
        break;
      default:
        throw new ProviderError('Unknown provider', 500);
    }
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    const msg = (err as Error).message;
    await logUsage({
      userId: context.userId,
      apiKeyId: context.apiKeyId,
      model: modelConfig,
      promptTokens: 0,
      completionTokens: 0,
      creditsUsed: 0,
      latencyMs: Date.now() - startTime,
      streaming: false,
      cached: false,
      status: 'ERROR',
      errorCode: 'PROVIDER_ERROR',
      errorMessage: msg,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw new ProviderError(`Provider call failed: ${msg}`, 502);
  }

  // 8. Handle streaming response (only when not in fallback mode)
  if (
    effectiveStreaming &&
    res &&
    !(providerResponse instanceof Object && 'choices' in providerResponse)
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const stream = providerResponse as ReadableStream;
    // For Gemini, providerResponse is an async generator
    if (modelConfig.provider === 'gemini') {
      const gen = providerResponse as unknown as AsyncGenerator<Uint8Array>;
      let totalText = '';
      for await (const chunk of gen) {
        const chunkStr = new TextDecoder().decode(chunk);
        res.write(chunkStr);
        // Extract text from chunk for usage tracking
        if (chunkStr.startsWith('data: ') && chunkStr !== 'data: [DONE]\n\n') {
          try {
            const parsed = JSON.parse(chunkStr.slice(6)) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            totalText += parsed.choices?.[0]?.delta?.content ?? '';
          } catch {
            /* ok */
          }
        }
      }

      // Send final metadata chunk
      const finalCredits = calculateCredits(
        modelConfig,
        estimatedInputTokens,
        Math.ceil(totalText.length / 4),
      );
      const metaChunk = {
        choices: [],
        usage: {
          prompt_tokens: estimatedInputTokens,
          completion_tokens: Math.ceil(totalText.length / 4),
          total_tokens: estimatedInputTokens + Math.ceil(totalText.length / 4),
        },
        x_fairarena: {
          credits_used: finalCredits,
          latency_ms: Date.now() - startTime,
          cached: false,
        },
      };
      res.write(`data: ${JSON.stringify(metaChunk)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();

      const completionTokens = Math.ceil(totalText.length / 4);
      const creditsUsed = calculateCredits(modelConfig, estimatedInputTokens, completionTokens);
      if (creditsUsed > 0) {
        deductUserCredits(
          context.userId,
          creditsUsed,
          `AI Gateway: ${modelConfig.displayName} (streaming)`,
        ).catch(() => {});
      }
      logUsage({
        userId: context.userId,
        apiKeyId: context.apiKeyId,
        model: modelConfig,
        promptTokens: estimatedInputTokens,
        completionTokens,
        creditsUsed,
        latencyMs: Date.now() - startTime,
        streaming: true,
        cached: false,
        status: 'SUCCESS',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return;
    }

    // For Groq / OpenRouter (already OpenAI-compatible SSE)
    const reader = (stream as ReadableStream).getReader();
    const decoder = new TextDecoder();
    let totalText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        res.write(chunk);

        // Extract content for usage tracking
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6)) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              totalText += parsed.choices?.[0]?.delta?.content ?? '';
            } catch {
              /* ok */
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Send final metadata chunk
    const finalCredits = calculateCredits(
      modelConfig,
      estimatedInputTokens,
      Math.ceil(totalText.length / 4),
    );
    const metaChunk = {
      choices: [],
      usage: {
        prompt_tokens: estimatedInputTokens,
        completion_tokens: Math.ceil(totalText.length / 4),
        total_tokens: estimatedInputTokens + Math.ceil(totalText.length / 4),
      },
      x_fairarena: {
        credits_used: finalCredits,
        latency_ms: Date.now() - startTime,
        cached: false,
      },
    };
    res.write(`data: ${JSON.stringify(metaChunk)}\n\n`);
    res.end();

    const completionTokens = Math.ceil(totalText.length / 4);
    const creditsUsed = calculateCredits(modelConfig, estimatedInputTokens, completionTokens);
    if (creditsUsed > 0) {
      deductUserCredits(
        context.userId,
        creditsUsed,
        `AI Gateway: ${modelConfig.displayName} (streaming)`,
      ).catch(() => {});
    }
    logUsage({
      userId: context.userId,
      apiKeyId: context.apiKeyId,
      model: modelConfig,
      promptTokens: estimatedInputTokens,
      completionTokens,
      creditsUsed,
      latencyMs: Date.now() - startTime,
      streaming: true,
      cached: false,
      status: 'SUCCESS',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return;
  }

  // 9. Handle non-streaming response
  let completion = providerResponse as AiGatewayResponse;
  // Apply fallback parser: converts <tool_call>…</tool_call> text into tool_calls array
  if (needsFallback) {
    completion = parseFallbackToolCall(completion);
  }
  const promptTokens = completion.usage?.prompt_tokens ?? estimatedInputTokens;
  const completionTokens = completion.usage?.completion_tokens ?? 0;
  const creditsUsed = calculateCredits(modelConfig, promptTokens, completionTokens);

  // Deduct credits
  if (creditsUsed > 0) {
    try {
      await deductUserCredits(
        context.userId,
        creditsUsed,
        `AI Gateway: ${modelConfig.displayName}`,
        { model: modelConfig.modelId, promptTokens, completionTokens },
      );
    } catch (err) {
      if ((err as Error).message === 'Insufficient credits') {
        throw new ProviderError('Insufficient credits to complete this request.', 402);
      }
      throw err;
    }
  }

  // Enrich response with FairArena metadata
  completion.model = modelConfig.modelId;
  completion.x_fairarena = {
    credits_used: creditsUsed,
    cached: false,
    latency_ms: Date.now() - startTime,
    model_info: {
      provider: modelConfig.provider,
      context_window: modelConfig.contextWindow,
    },
  };

  // Cache the response
  if (enableCache && cacheKey) {
    setCachedResponse(cacheKey, completion, cacheTtl);
  }

  // Log usage
  await logUsage({
    userId: context.userId,
    apiKeyId: context.apiKeyId,
    model: modelConfig,
    promptTokens,
    completionTokens,
    creditsUsed,
    latencyMs: Date.now() - startTime,
    streaming: false,
    cached: false,
    status: 'SUCCESS',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return completion;
}

// ─── Usage Statistics ─────────────────────────────────────────────────────────

export async function getUserGatewayStats(userId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const [totals, modelBreakdown, recentRequests] = await Promise.all([
      prisma.aiGatewayRequest.aggregate({
        where: { userId, createdAt: { gte: since } },
        _sum: { creditsUsed: true, totalTokens: true, promptTokens: true, completionTokens: true },
        _count: { id: true },
        _avg: { latencyMs: true },
      }),
      prisma.aiGatewayRequest.groupBy({
        by: ['model', 'provider'],
        where: { userId, createdAt: { gte: since } },
        _sum: { creditsUsed: true, totalTokens: true },
        _count: { id: true },
        orderBy: { _sum: { creditsUsed: 'desc' } },
      }),
      prisma.aiGatewayRequest.findMany({
        where: { userId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          model: true,
          provider: true,
          promptTokens: true,
          completionTokens: true,
          creditsUsed: true,
          latencyMs: true,
          streaming: true,
          cached: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      period: `${days} days`,
      summary: {
        totalRequests: totals._count.id,
        totalCreditsUsed: totals._sum.creditsUsed ?? 0,
        totalTokens: totals._sum.totalTokens ?? 0,
        promptTokens: totals._sum.promptTokens ?? 0,
        completionTokens: totals._sum.completionTokens ?? 0,
        averageLatencyMs: Math.round(totals._avg.latencyMs ?? 0),
      },
      modelBreakdown: modelBreakdown.map((m) => ({
        model: m.model,
        provider: m.provider,
        requests: m._count.id,
        creditsUsed: m._sum.creditsUsed ?? 0,
        tokens: m._sum.totalTokens ?? 0,
      })),
      recentRequests,
    };
  } catch (err) {
    const errMsg = (err as Error).message ?? '';
    if (errMsg.includes('does not exist') || errMsg.includes('AiGatewayRequest')) {
      return {
        period: `${days} days`,
        summary: {
          totalRequests: 0,
          totalCreditsUsed: 0,
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          averageLatencyMs: 0,
        },
        modelBreakdown: [],
        recentRequests: [],
      };
    }
    throw err;
  }
}
