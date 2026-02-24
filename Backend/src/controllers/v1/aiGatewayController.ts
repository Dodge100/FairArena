/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

/**
 * AI Gateway Controller
 * OpenAI-compatible API endpoints for FairArena's AI gateway.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import {
  getActiveModelsList,
  getModelConfig,
  PROVIDER_METADATA,
} from '../../config/ai-gateway-models.js';
import {
  AiGatewayRequest,
  GatewayCallContext,
  getUserGatewayStats,
  processAiGatewayRequest,
  ProviderError,
} from '../../services/v1/aiGateway.service.js';
import { getUserCreditBalance } from '../../services/v1/creditService.js';
import { getModelStatus, runStatusProbes } from '../../services/v1/modelStatus.service.js';
import logger from '../../utils/logger.js';

// ─── Validation Schema ────────────────────────────────────────────────────────

const chatMessageContentSchema = z.union([
  z.string(),
  z.array(
    z.object({
      type: z.enum(['text', 'image_url']),
      text: z.string().optional(),
      image_url: z
        .object({
          url: z.string().url(),
          detail: z.enum(['auto', 'low', 'high']).optional(),
        })
        .optional(),
    }),
  ),
]);

const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: chatMessageContentSchema,
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
});

const toolSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()),
  }),
});

const chatCompletionSchema = z.object({
  model: z.string().min(1, 'model is required'),
  messages: z.array(chatMessageSchema).min(1, 'At least one message is required'),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  tools: z.array(toolSchema).optional(),
  tool_choice: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  user: z.string().optional(),
  // FairArena-specific
  cache: z.boolean().optional(),
  cache_ttl: z.number().int().min(10).max(3600).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractContext(req: Request): GatewayCallContext {
  return {
    userId: req.userId!,
    apiKeyId: req.apiKey?.id,
    ipAddress:
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'],
  };
}

// ─── POST /chat/completions ───────────────────────────────────────────────────

export const chatCompletions = async (req: Request, res: Response): Promise<void> => {
  const validation = chatCompletionSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      error: {
        type: 'invalid_request_error',
        message: 'Request validation failed',
        details: validation.error.flatten().fieldErrors,
        code: 'invalid_request',
      },
    });
    return;
  }

  const request = validation.data as AiGatewayRequest;
  const context = extractContext(req);

  logger.info('AI Gateway: incoming request', {
    userId: context.userId,
    model: request.model,
    streaming: request.stream ?? false,
    messageCount: request.messages.length,
  });

  try {
    const result = await processAiGatewayRequest(
      request,
      context,
      request.stream ? res : undefined,
    );

    if (request.stream) {
      if (!res.headersSent) {
        res.end();
      }
      return;
    }

    res.json(result);
  } catch (err) {
    if (err instanceof ProviderError) {
      const statusToErrorType: Record<number, string> = {
        400: 'invalid_request_error',
        401: 'authentication_error',
        402: 'insufficient_quota',
        404: 'not_found_error',
        429: 'rate_limit_error',
        500: 'server_error',
        502: 'provider_error',
        503: 'service_unavailable',
      };

      const statusCode = err.status || err.statusCode || 500;
      const errorType = statusToErrorType[statusCode] ?? 'server_error';

      res.status(statusCode).json({
        error: {
          type: errorType,
          message: err.message,
          code: err.message
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z_]/g, '')
            .substring(0, 50),
        },
      });
      return;
    }

    logger.error('AI Gateway: unhandled error', {
      error: (err as Error).message,
      userId: context.userId,
    });
    res.status(500).json({
      error: {
        type: 'server_error',
        message: 'An internal server error occurred',
        code: 'internal_error',
      },
    });
  }
};

// ─── GET /models ──────────────────────────────────────────────────────────────

export const listModels = (_req: Request, res: Response): void => {
  const activeModels = getActiveModelsList();

  const data = activeModels.map((m) => ({
    id: m.modelId,
    object: 'model',
    created: 1700000000,
    owned_by: m.provider,
    display_name: m.displayName,
    description: m.description,
    category: m.category,
    context_window: m.contextWindow,
    max_output_tokens: m.maxOutputTokens,
    supports_streaming: m.supportsStreaming,
    supports_vision: m.supportsVision,
    supports_tool_calling: m.supportsToolCalling,
    pricing: {
      input_credits_per_1k_tokens: m.inputCreditsPerK,
      output_credits_per_1k_tokens: m.outputCreditsPerK,
    },
    tags: m.tags ?? [],
    rate_limits: { rpm: null, rpd: null },
  }));

  // Build per-category stats
  const stats: Record<string, number> = {};
  for (const m of data) {
    stats[m.category] = (stats[m.category] ?? 0) + 1;
  }

  res.json({
    object: 'list',
    data,
    total: data.length,
    providers: PROVIDER_METADATA,
    stats,
  });
};

// ─── GET /models/:modelId ─────────────────────────────────────────────────────

export const getModel = (req: Request, res: Response): void => {
  const rawModelId = req.params['modelId'] ?? req.params[0] ?? '';
  const modelId = Array.isArray(rawModelId) ? rawModelId.join('/') : decodeURIComponent(rawModelId);
  const model = getModelConfig(modelId);

  if (!model) {
    res.status(404).json({
      error: {
        type: 'not_found_error',
        message: `Model '${modelId}' not found`,
        code: 'model_not_found',
      },
    });
    return;
  }

  res.json({
    id: model.modelId,
    object: 'model',
    created: 1700000000,
    owned_by: model.provider,
    display_name: model.displayName,
    description: model.description,
    category: model.category,
    context_window: model.contextWindow,
    max_output_tokens: model.maxOutputTokens,
    supports_streaming: model.supportsStreaming,
    supports_vision: model.supportsVision,
    supports_tool_calling: model.supportsToolCalling,
    isActive: model.isActive,
    pricing: {
      input_credits_per_1k_tokens: model.inputCreditsPerK,
      output_credits_per_1k_tokens: model.outputCreditsPerK,
    },
  });
};

// ─── GET /usage ───────────────────────────────────────────────────────────────

export const getUsageHandler = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const days = parseInt(req.query.days as string) || 30;

  try {
    const stats = await getUserGatewayStats(userId, days);
    res.json({ success: true, data: stats });
  } catch (err) {
    logger.error('AI Gateway: failed to get usage', { userId, error: (err as Error).message });
    res.status(500).json({
      error: {
        type: 'server_error',
        message: 'Failed to retrieve usage stats',
        code: 'internal_error',
      },
    });
  }
};

// ─── GET /balance ────────────────────────────────────────────────────────────

export const getBalanceHandler = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    const balance = await getUserCreditBalance(userId);
    res.json({
      success: true,
      data: {
        credits: balance,
        userId,
        note: 'Credits are consumed per API request based on model pricing.',
      },
    });
  } catch (err) {
    logger.error('AI Gateway: failed to get balance', { userId, error: (err as Error).message });
    res.status(500).json({
      error: {
        type: 'server_error',
        message: 'Failed to retrieve balance',
        code: 'internal_error',
      },
    });
  }
};

// ─── GET /models/status ───────────────────────────────────────────────────────

export const getModelStatusHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    // getModelStatus() already returns { success, data: { models, probeRanAt, incidentHistory } }
    // Forwarding directly avoids double-nesting the response
    const snapshot = await getModelStatus();
    res.json(snapshot);
  } catch (err) {
    logger.error('AI Gateway: failed to get model status', { error: (err as Error).message });
    res.status(500).json({
      error: { type: 'server_error', message: 'Failed to retrieve status', code: 'internal_error' },
    });
  }
};

// ─── POST /models/probe ───────────────────────────────────────────────────────

export const triggerModelProbe = async (_req: Request, res: Response): Promise<void> => {
  try {
    void runStatusProbes().catch((err) =>
      logger.error('Model status probe failed', { error: (err as Error).message }),
    );
    res.json({ success: true, message: 'Probe started in background.' });
  } catch (err) {
    logger.error('AI Gateway: failed to trigger probe', { error: (err as Error).message });
    res.status(500).json({
      error: { type: 'server_error', message: 'Failed to start probe', code: 'internal_error' },
    });
  }
};
