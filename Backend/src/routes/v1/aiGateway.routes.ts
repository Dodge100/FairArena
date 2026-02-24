/**
 * AI Gateway Routes
 *
 * OpenAI-compatible endpoints:
 *   POST /v1/chat/completions   → chatCompletions
 *   GET  /v1/models             → listModels
 *   GET  /v1/models/:modelId    → getModel
 *   GET  /v1/usage              → getUsage
 *   GET  /v1/balance            → getGatewayBalance
 *
 * Auth: API Key (Bearer fa_live_xxx) or session cookie
 * Both auth methods are supported via apiKeyAuth | protectRoute.
 */
import { Router } from 'express';
import {
  chatCompletions,
  getBalanceHandler,
  getModel,
  getModelStatusHandler,
  getUsageHandler,
  listModels,
  triggerModelProbe,
} from '../../controllers/v1/aiGatewayController.js';
import { apiKeyAuth } from '../../middleware/apiKey.middleware.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

/**
 * Middleware that accepts either API key auth or session auth.
 * API key takes priority (ideal for programmatic access via SDK).
 */
async function flexAuth(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
) {
  // If already authenticated via session (e.g. in-dashboard usage), skip API key check
  if (req.userId) {
    return next();
  }

  // Check if an API key is present
  const authHeader = req.headers.authorization;
  const xApiKey = req.headers['x-api-key'] as string | undefined;
  const hasApiKey =
    (authHeader?.startsWith('Bearer ') && authHeader.substring(7).startsWith('fa_')) ||
    xApiKey?.startsWith('fa_');

  if (hasApiKey) {
    return apiKeyAuth(req, res, next);
  }

  // Fall back to session auth
  return protectRoute(req, res, next);
}

// ─── Public ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /v1/models:
 *   get:
 *     summary: List available AI models
 *     description: Returns all available models with pricing, capabilities, and metadata. No auth required.
 *     tags: [AI Gateway]
 *     responses:
 *       200:
 *         description: List of available models
 */
router.get('/models', listModels);

/**
 * @swagger
 * /v1/models/status:
 *   get:
 *     summary: Model health and uptime status
 *     description: Returns real-time model availability, latency, and 24-hour uptime percentage. No auth required.
 *     tags: [AI Gateway]
 */
router.get('/models/status', getModelStatusHandler);

/**
 * @swagger
 * /v1/models/probe:
 *   post:
 *     summary: Trigger a fresh probe
 *     description: Starts a new health probe in the background. Rate-limited. Returns immediately.
 *     tags: [AI Gateway]
 *     security:
 *       - bearerAuth: []
 */
router.post('/models/probe', flexAuth, triggerModelProbe);

/**
 * @swagger
 * /v1/models/{modelId}:
 *   get:
 *     summary: Get model details
 *     description: Get detailed information about a specific model.
 *     tags: [AI Gateway]
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         example: "groq/llama-3.1-70b-versatile"
 *     responses:
 *       200:
 *         description: Model details
 *       404:
 *         description: Model not found
 */
router.get(/^\/models\/(?<modelId>.+)/, getModel);

// ─── Authenticated ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /v1/chat/completions:
 *   post:
 *     summary: Create a chat completion
 *     description: |
 *       OpenAI-compatible chat completion endpoint. Supports streaming via `stream: true`.
 *
 *       **Authentication:** Bearer token (API Key `fa_live_xxx`) or session cookie.
 *
 *       **Credit Usage:** Credits are automatically deducted based on model pricing and token usage.
 *       Free models (`:free` suffix) never consume credits.
 *
 *       **Caching:** Non-streaming identical requests are cached by default for 5 minutes (`cache: true`).
 *       Cached responses consume 0 credits.
 *
 *       **Example with cURL:**
 *       ```bash
 *       curl https://api.fairarena.app/v1/chat/completions \
 *         -H "Authorization: Bearer fa_live_yourkey" \
 *         -H "Content-Type: application/json" \
 *         -d '{"model":"groq/llama-3.1-70b-versatile","messages":[{"role":"user","content":"Hello!"}]}'
 *       ```
 *     tags: [AI Gateway]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - model
 *               - messages
 *             properties:
 *               model:
 *                 type: string
 *                 description: Model ID from /v1/models
 *                 example: "groq/llama-3.1-70b-versatile"
 *               messages:
 *                 type: array
 *                 description: Conversation messages
 *                 items:
 *                   type: object
 *                   required: [role, content]
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [system, user, assistant, tool]
 *                     content:
 *                       oneOf:
 *                         - type: string
 *                         - type: array
 *                           items:
 *                             type: object
 *               stream:
 *                 type: boolean
 *                 default: false
 *                 description: Enable SSE streaming
 *               temperature:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 2
 *                 default: 1
 *               max_tokens:
 *                 type: integer
 *                 description: Maximum tokens to generate
 *               top_p:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *               frequency_penalty:
 *                 type: number
 *                 minimum: -2
 *                 maximum: 2
 *               presence_penalty:
 *                 type: number
 *                 minimum: -2
 *                 maximum: 2
 *               stop:
 *                 oneOf:
 *                   - type: string
 *                   - type: array
 *                     items:
 *                       type: string
 *               tools:
 *                 type: array
 *                 description: Available tools/functions
 *               tool_choice:
 *                 description: Tool selection strategy
 *               cache:
 *                 type: boolean
 *                 default: true
 *                 description: Cache identical requests (FairArena-specific)
 *               cache_ttl:
 *                 type: integer
 *                 default: 300
 *                 description: Cache lifetime in seconds (10-3600)
 *     responses:
 *       200:
 *         description: Chat completion response (or SSE stream)
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized - missing or invalid API key
 *       402:
 *         description: Insufficient credits
 *       404:
 *         description: Model not found
 *       429:
 *         description: Rate limit exceeded (60 req/min)
 *       502:
 *         description: Provider error
 */
router.post('/chat/completions', flexAuth, chatCompletions);

/**
 * @swagger
 * /v1/usage:
 *   get:
 *     summary: Get AI Gateway usage statistics
 *     description: Returns aggregated token and credit usage stats for the authenticated user.
 *     tags: [AI Gateway]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 90
 *         description: Days to look back
 *     responses:
 *       200:
 *         description: Usage statistics
 */
router.get('/usage', flexAuth, getUsageHandler);

/**
 * @swagger
 * /v1/balance:
 *   get:
 *     summary: Get credit balance
 *     description: Returns the current credit balance for use with the AI Gateway.
 *     tags: [AI Gateway]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Credit balance
 */
router.get('/balance', flexAuth, getBalanceHandler);

export default router;
