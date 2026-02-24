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
 * AI Gateway Model Registry
 * Covers text, vision, coding, reasoning.
 * All models are zero-cost to host (free-tier APIs) — we charge users credits.
 *
 * Providers:
 *   groq       – Groq LPU (ultra-low latency)
 *   gemini     – Google Gemini API
 *   openrouter – OpenRouter (free-tier models from many labs)
 *   cloudflare – Cloudflare Workers AI (free tier)
 */

export type ModelProvider = 'groq' | 'gemini' | 'openrouter' | 'cloudflare';

export type ModelCategory =
  | 'fast'
  | 'balanced'
  | 'powerful'
  | 'vision'
  | 'coding'
  | 'reasoning'
  | 'image-generation'
  | 'embedding'
  | 'safety';

export interface ModelConfig {
  modelId: string;
  displayName: string;
  provider: ModelProvider;
  providerModelId: string;
  inputCreditsPerK: number;
  outputCreditsPerK: number;
  contextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsToolCalling: boolean;
  isActive: boolean;
  category: ModelCategory;
  description: string;
  tags?: string[];
}

export const PROVIDER_METADATA: Record<
  ModelProvider,
  { name: string; description: string; icon: string }
> = {
  groq: {
    name: 'Groq',
    description: 'Ultra-low latency inference engine using LPU technology.',
    icon: '⚡',
  },
  gemini: {
    name: 'Google Gemini',
    description: 'Google flagship multimodal models with large context windows.',
    icon: '🔷',
  },
  openrouter: {
    name: 'OpenRouter',
    description: 'Unified interface for open and closed source models.',
    icon: '🌐',
  },
  cloudflare: {
    name: 'Cloudflare Workers AI',
    description: 'Run AI models at the edge via Cloudflare — free tier.',
    icon: '☁️',
  },
};

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // ═══════════════════════════════════════════════════════════════════
  // GROQ — Ultra-Fast Inference (models from Groq console)
  // ═══════════════════════════════════════════════════════════════════

  // ── Text / Multilingual ──
  'groq/llama-3.3-70b': {
    modelId: 'groq/llama-3.3-70b',
    displayName: 'Llama 3.3 70B',
    provider: 'groq',
    providerModelId: 'llama-3.3-70b-versatile',
    inputCreditsPerK: 2,
    outputCreditsPerK: 2,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'balanced',
    description: 'Meta Llama 3.3 70B — GPT-4 level performance on Groq LPU speed.',
    tags: ['meta', 'llama', 'popular', 'multilingual'],
  },

  'groq/gpt-oss-120b': {
    modelId: 'groq/gpt-oss-120b',
    displayName: 'GPT-OSS 120B',
    provider: 'groq',
    providerModelId: 'gpt-oss-120b',
    inputCreditsPerK: 4,
    outputCreditsPerK: 4,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'powerful',
    description: 'OpenAI GPT-OSS 120B — high intelligence open-weight model on Groq.',
    tags: ['openai', 'powerful', 'new'],
  },

  'groq/gpt-oss-20b': {
    modelId: 'groq/gpt-oss-20b',
    displayName: 'GPT-OSS 20B',
    provider: 'groq',
    providerModelId: 'gpt-oss-20b',
    inputCreditsPerK: 2,
    outputCreditsPerK: 2,
    contextWindow: 64000,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: 'OpenAI GPT-OSS 20B — optimized for speed and efficiency.',
    tags: ['openai', 'fast'],
  },

  // ── Vision ──
  'groq/llama-4-scout': {
    modelId: 'groq/llama-4-scout',
    displayName: 'Llama 4 Scout',
    provider: 'groq',
    providerModelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
    inputCreditsPerK: 2,
    outputCreditsPerK: 2,
    contextWindow: 131072,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: true,
    isActive: true,
    category: 'vision',
    description: 'Meta Llama 4 Scout — fast multimodal model with vision and tool use.',
    tags: ['meta', 'llama', 'vision', 'multilingual'],
  },

  'groq/llama-4-maverick': {
    modelId: 'groq/llama-4-maverick',
    displayName: 'Llama 4 Maverick',
    provider: 'groq',
    providerModelId: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    inputCreditsPerK: 3,
    outputCreditsPerK: 3,
    contextWindow: 131072,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    category: 'vision',
    description: 'Meta Llama 4 Maverick — powerful multimodal reasoning.',
    tags: ['meta', 'llama', 'vision', 'powerful'],
  },

  // ── Reasoning ──
  'groq/qwen-3-32b': {
    modelId: 'groq/qwen-3-32b',
    displayName: 'Qwen 3 32B',
    provider: 'groq',
    providerModelId: 'qwen/qwen3-32b',
    inputCreditsPerK: 2,
    outputCreditsPerK: 2,
    contextWindow: 131072,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'reasoning',
    description: 'Alibaba Qwen 3 32B — strong reasoning and function calling.',
    tags: ['qwen', 'reasoning', 'multilingual'],
  },

  // ── Safety ──
  'groq/gpt-oss-safeguard': {
    modelId: 'groq/gpt-oss-safeguard',
    displayName: 'GPT-OSS Safeguard 20B',
    provider: 'groq',
    providerModelId: 'openai/gpt-oss-safeguard-20b',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 8192,
    maxOutputTokens: 1024,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'safety',
    description: 'OpenAI GPT-OSS Safeguard 20B — specialized reasoning for safety workflows.',
    tags: ['openai', 'safety', 'moderation'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // GEMINI — Only models with confirmed free-tier quota
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  // GEMINI — Models with confirmed non-zero quota (Feb 2026)
  // ═══════════════════════════════════════════════════════════════════

  // Gemini 2.5 Flash — 5 RPM / 250K TPM / 20 RPD
  'gemini/gemini-2.5-flash': {
    modelId: 'gemini/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'gemini',
    providerModelId: 'gemini-2.5-flash',
    inputCreditsPerK: 2,
    outputCreditsPerK: 3,
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: true,
    isActive: true,
    category: 'fast',
    description: 'Gemini 2.5 Flash — optimal balance of intelligence and low latency.',
    tags: ['google', 'gemini', 'vision', 'popular'],
  },

  // Gemini 2.5 Flash Lite — 10 RPM / 250K TPM / 20 RPD
  'gemini/gemini-2.5-flash-lite': {
    modelId: 'gemini/gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    providerModelId: 'gemini-2.5-flash-lite',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: true,
    isActive: true,
    category: 'fast',
    description: 'Gemini 2.5 Flash Lite — high throughput at minimal cost.',
    tags: ['google', 'gemini', 'vision', 'fast'],
  },

  // Gemini 3 Flash — 5 RPM / 250K TPM / 20 RPD
  'gemini/gemini-3-flash': {
    modelId: 'gemini/gemini-3-flash',
    displayName: 'Gemini 3 Flash',
    provider: 'gemini',
    providerModelId: 'gemini-3-flash-preview',
    inputCreditsPerK: 3,
    outputCreditsPerK: 5,
    contextWindow: 2097152,
    maxOutputTokens: 65536,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: true,
    isActive: true,
    category: 'fast',
    description: 'Gemini 3 Flash — frontier-class speed and logic, currently in preview.',
    tags: ['google', 'gemini', 'frontier', 'preview'],
  },

  // Gemma 3 27B — 30 RPM / 15K TPM / 14.4K RPD
  'gemini/gemma-3-27b': {
    modelId: 'gemini/gemma-3-27b',
    displayName: 'Gemma 3 27B',
    provider: 'gemini',
    providerModelId: 'gemma-3-27b-it',
    inputCreditsPerK: 2,
    outputCreditsPerK: 3,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: true,
    isActive: true,
    category: 'powerful',
    description: 'Google Gemma 3 27B — state-of-the-art open multimodal model.',
    tags: ['google', 'gemma', 'vision'],
  },

  // Gemma 3 12B — 30 RPM / 15K TPM / 14.4K RPD
  'gemini/gemma-3-12b': {
    modelId: 'gemini/gemma-3-12b',
    displayName: 'Gemma 3 12B',
    provider: 'gemini',
    providerModelId: 'gemma-3-12b-it',
    inputCreditsPerK: 1,
    outputCreditsPerK: 2,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: true,
    isActive: true,
    category: 'balanced',
    description: 'Google Gemma 3 12B — ideal for tool-use and efficient reasoning.',
    tags: ['google', 'gemma', 'vision'],
  },

  // Gemma 3 4B — 30 RPM / 15K TPM / 14.4K RPD
  'gemini/gemma-3-4b': {
    modelId: 'gemini/gemma-3-4b',
    displayName: 'Gemma 3 4B',
    provider: 'gemini',
    providerModelId: 'gemma-3-4b-it',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: 'Google Gemma 3 4B — compact and fast with vision support.',
    tags: ['google', 'gemma', 'vision', 'fast'],
  },

  // Gemma 3 2B — 30 RPM / 15K TPM / 14.4K RPD
  'gemini/gemma-3-2b': {
    modelId: 'gemini/gemma-3-2b',
    displayName: 'Gemma 3 2B',
    provider: 'gemini',
    providerModelId: 'gemma-3-2b-it',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: 'Google Gemma 3 2B — ultra-lightweight for basic edge tasks.',
    tags: ['google', 'gemma', 'tiny'],
  },

  // Gemma 3 1B — 30 RPM / 15K TPM / 14.4K RPD
  'gemini/gemma-3-1b': {
    modelId: 'gemini/gemma-3-1b',
    displayName: 'Gemma 3 1B',
    provider: 'gemini',
    providerModelId: 'gemma-3-1b-it',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 32768,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: 'Google Gemma 3 1B — smallest open model, maximum speed.',
    tags: ['google', 'gemma', 'tiny'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // CLOUDFLARE — Workers AI (Text Generation)
  // Full model list from: developers.cloudflare.com/workers-ai/models/
  // ═══════════════════════════════════════════════════════════════════

  // ── Pinneed / Featured ──
  'cloudflare/llama-4-scout-17b': {
    modelId: 'cloudflare/llama-4-scout-17b',
    displayName: 'Llama 4 Scout 17B',
    provider: 'cloudflare',
    providerModelId: '@cf/meta/llama-4-scout-17b-16e-instruct',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: true,
    isActive: true,
    category: 'vision',
    description: 'Meta Llama 4 Scout 17B — multimodal MoE model on Cloudflare edge.',
    tags: ['meta', 'llama', 'cloudflare', 'vision', 'moe'],
  },

  'cloudflare/gpt-oss-120b': {
    modelId: 'cloudflare/gpt-oss-120b',
    displayName: 'GPT-OSS 120B',
    provider: 'cloudflare',
    providerModelId: '@cf/openai/gpt-oss-120b',
    inputCreditsPerK: 2,
    outputCreditsPerK: 2,
    contextWindow: 64000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'powerful',
    description: "OpenAI's open-weight 120B model — production-grade high reasoning on CF edge.",
    tags: ['openai', 'cloudflare', 'powerful'],
  },

  'cloudflare/gpt-oss-20b': {
    modelId: 'cloudflare/gpt-oss-20b',
    displayName: 'GPT-OSS 20B',
    provider: 'cloudflare',
    providerModelId: '@cf/openai/gpt-oss-20b',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 64000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: "OpenAI's open-weight 20B model — lower latency specialized tasks on CF edge.",
    tags: ['openai', 'cloudflare'],
  },

  // ── Llama Family ──
  'cloudflare/llama-3.3-70b': {
    modelId: 'cloudflare/llama-3.3-70b',
    displayName: 'Llama 3.3 70B',
    provider: 'cloudflare',
    providerModelId: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'balanced',
    description: 'Llama 3.3 70B fp8 — optimised for speed on Cloudflare LPU edge.',
    tags: ['meta', 'llama', 'cloudflare'],
  },

  'cloudflare/llama-3.1-8b': {
    modelId: 'cloudflare/llama-3.1-8b',
    displayName: 'Llama 3.1 8B Fast',
    provider: 'cloudflare',
    providerModelId: '@cf/meta/llama-3.1-8b-instruct-fast',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: 'Llama 3.1 8B — fast multilingual model on Cloudflare edge.',
    tags: ['meta', 'llama', 'cloudflare', 'fast'],
  },

  'cloudflare/llama-3.2-3b': {
    modelId: 'cloudflare/llama-3.2-3b',
    displayName: 'Llama 3.2 3B',
    provider: 'cloudflare',
    providerModelId: '@cf/meta/llama-3.2-3b-instruct',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: 'Llama 3.2 3B — compact multilingual model, ideal for low-latency tasks.',
    tags: ['meta', 'llama', 'cloudflare', 'tiny'],
  },

  'cloudflare/llama-3.2-1b': {
    modelId: 'cloudflare/llama-3.2-1b',
    displayName: 'Llama 3.2 1B',
    provider: 'cloudflare',
    providerModelId: '@cf/meta/llama-3.2-1b-instruct',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: 'Llama 3.2 1B — ultra-lightweight for edge and realtime use.',
    tags: ['meta', 'llama', 'cloudflare', 'tiny'],
  },

  'cloudflare/llama-3.2-11b-vision': {
    modelId: 'cloudflare/llama-3.2-11b-vision',
    displayName: 'Llama 3.2 11B Vision',
    provider: 'cloudflare',
    providerModelId: '@cf/meta/llama-3.2-11b-vision-instruct',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    category: 'vision',
    description: 'Llama 3.2 11B with vision — image reasoning on Cloudflare edge.',
    tags: ['meta', 'llama', 'cloudflare', 'vision'],
  },

  // ── Qwen Family ──
  'cloudflare/deepseek-r1-32b': {
    modelId: 'cloudflare/deepseek-r1-32b',
    displayName: 'DeepSeek R1 32B',
    provider: 'cloudflare',
    providerModelId: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    inputCreditsPerK: 2,
    outputCreditsPerK: 2,
    contextWindow: 32768,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'reasoning',
    description: 'DeepSeek R1 32B distill — strong reasoning on Cloudflare edge.',
    tags: ['deepseek', 'reasoning', 'cloudflare'],
  },

  'cloudflare/qwen3-30b-fp8': {
    modelId: 'cloudflare/qwen3-30b-fp8',
    displayName: 'Qwen3 30B FP8',
    provider: 'cloudflare',
    providerModelId: '@cf/qwen/qwen3-30b-a3b-fp8',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 32768,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'reasoning',
    description: 'Qwen3 30B MoE FP8 — reasoning and tool calling on Cloudflare.',
    tags: ['qwen', 'reasoning', 'cloudflare', 'moe'],
  },

  'cloudflare/qwq-32b': {
    modelId: 'cloudflare/qwq-32b',
    displayName: 'QwQ 32B',
    provider: 'cloudflare',
    providerModelId: '@cf/qwen/qwq-32b',
    inputCreditsPerK: 2,
    outputCreditsPerK: 2,
    contextWindow: 32768,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'reasoning',
    description: 'QwQ-32B — Qwen reasoning model, competitive with o1-mini.',
    tags: ['qwen', 'reasoning', 'cloudflare'],
  },

  'cloudflare/qwen-coder-32b': {
    modelId: 'cloudflare/qwen-coder-32b',
    displayName: 'Qwen 2.5 Coder 32B',
    provider: 'cloudflare',
    providerModelId: '@cf/qwen/qwen2.5-coder-32b-instruct',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 32768,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'coding',
    description: 'Qwen 2.5 Coder 32B — top open-source coding model on CF edge.',
    tags: ['qwen', 'coding', 'cloudflare'],
  },

  // ── Mistral Family ──
  'cloudflare/mistral-small-3.1-24b': {
    modelId: 'cloudflare/mistral-small-3.1-24b',
    displayName: 'Mistral Small 3.1 24B',
    provider: 'cloudflare',
    providerModelId: '@cf/mistralai/mistral-small-3.1-24b-instruct',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: true,
    isActive: true,
    category: 'balanced',
    description: 'Mistral Small 3.1 24B — vision + function calling on Cloudflare.',
    tags: ['mistral', 'cloudflare', 'vision'],
  },

  // ── Google Gemma Family ──
  'cloudflare/gemma-3-12b': {
    modelId: 'cloudflare/gemma-3-12b',
    displayName: 'Gemma 3 12B',
    provider: 'cloudflare',
    providerModelId: '@cf/google/gemma-3-12b-it',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    category: 'balanced',
    description: 'Google Gemma 3 12B — multimodal model on Cloudflare global network.',
    tags: ['google', 'gemma', 'cloudflare', 'vision'],
  },

  // ── IBM Granite ──
  'cloudflare/granite-4.0-micro': {
    modelId: 'cloudflare/granite-4.0-micro',
    displayName: 'Granite 4.0 Micro',
    provider: 'cloudflare',
    providerModelId: '@cf/ibm/granite-4.0-h-micro',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 32768,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'fast',
    description: 'IBM Granite 4.0 Micro — agent/RAG tasks with function calling on edge.',
    tags: ['ibm', 'granite', 'cloudflare', 'agentic'],
  },

  // ── GLM Family ──
  'cloudflare/glm-4.7-flash': {
    modelId: 'cloudflare/glm-4.7-flash',
    displayName: 'GLM 4.7 Flash',
    provider: 'cloudflare',
    providerModelId: '@cf/zai-org/glm-4.7-flash',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'fast',
    description: 'GLM 4.7 Flash — 100+ language multilingual model with tool calling on CF.',
    tags: ['z-ai', 'glm', 'cloudflare', 'multilingual'],
  },

  // ── Hermes ──
  'cloudflare/hermes-2-pro-mistral-7b': {
    modelId: 'cloudflare/hermes-2-pro-mistral-7b',
    displayName: 'Hermes 2 Pro 7B',
    provider: 'cloudflare',
    providerModelId: '@cf/nousresearch/hermes-2-pro-mistral-7b',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 8192,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'balanced',
    description: 'Hermes 2 Pro on Mistral 7B — function calling + JSON mode on CF.',
    tags: ['nousresearch', 'hermes', 'cloudflare'],
  },

  // ── Llama Guard (Safety) ──
  'cloudflare/llama-guard-3-8b': {
    modelId: 'cloudflare/llama-guard-3-8b',
    displayName: 'Llama Guard 3 8B',
    provider: 'cloudflare',
    providerModelId: '@cf/meta/llama-guard-3-8b',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 8192,
    maxOutputTokens: 1024,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'safety',
    description: 'Llama Guard 3 — content safety classification for prompts & responses.',
    tags: ['meta', 'llama', 'cloudflare', 'safety'],
  },

  // ── SEA-LION (Southeast Asian Languages) ──
  'cloudflare/gemma-sea-lion-v4-27b': {
    modelId: 'cloudflare/gemma-sea-lion-v4-27b',
    displayName: 'SEA-LION v4 27B',
    provider: 'cloudflare',
    providerModelId: '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'balanced',
    description: 'SEA-LION v4 27B — Southeast Asian language specialist model on CF.',
    tags: ['aisingapore', 'cloudflare', 'multilingual', 'sea'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // OPENROUTER — Free Tier Only (:free models)
  // ═══════════════════════════════════════════════════════════════════

  // ── High Traffic / Popular Free Models ──
  'openrouter/arcee-trinity-large': {
    modelId: 'openrouter/arcee-trinity-large',
    displayName: 'Arcee Trinity Large',
    provider: 'openrouter',
    providerModelId: 'arcee-ai/arcee-trinity-large-preview:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'powerful',
    description: 'Arcee Trinity Large Preview — top free model by weekly tokens.',
    tags: ['arcee', 'free', 'popular'],
  },

  'openrouter/stepfun-step-3.5-flash': {
    modelId: 'openrouter/stepfun-step-3.5-flash',
    displayName: 'Step 3.5 Flash',
    provider: 'openrouter',
    providerModelId: 'stepfun-ai/step-3.5-flash:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 256000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: 'StepFun Step 3.5 Flash — 256K context, ultra-fast free model.',
    tags: ['stepfun', 'free', 'fast'],
  },

  'openrouter/glm-4.5-air': {
    modelId: 'openrouter/glm-4.5-air',
    displayName: 'GLM 4.5 Air',
    provider: 'openrouter',
    providerModelId: 'z-ai/glm-4.5-air:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'fast',
    description: 'Z.ai GLM 4.5 Air — efficient Chinese-English bilingual model.',
    tags: ['z-ai', 'glm', 'free', 'multilingual'],
  },

  // ── Reasoning ──
  'openrouter/deepseek-r1-0528': {
    modelId: 'openrouter/deepseek-r1-0528',
    displayName: 'DeepSeek R1 0528',
    provider: 'openrouter',
    providerModelId: 'deepseek/deepseek-r1-0528:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 163840,
    maxOutputTokens: 32768,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'reasoning',
    description: 'DeepSeek R1 (May 2025) — state-of-the-art open reasoning model.',
    tags: ['deepseek', 'reasoning', 'free', 'popular'],
  },

  'openrouter/qwen3-coder-480b': {
    modelId: 'openrouter/qwen3-coder-480b',
    displayName: 'Qwen3 Coder 480B',
    provider: 'openrouter',
    providerModelId: 'qwen/qwen3-coder-480b-a35b-instruct:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 262000,
    maxOutputTokens: 32768,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'coding',
    description: 'Qwen3 Coder 480B MoE — massive open coding model.',
    tags: ['qwen', 'coding', 'free'],
  },

  'openrouter/qwen3-30b-a3b': {
    modelId: 'openrouter/qwen3-30b-a3b',
    displayName: 'Qwen3 30B A3B',
    provider: 'openrouter',
    providerModelId: 'qwen/qwen3-30b-a3b:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 262144,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'reasoning',
    description: 'Qwen3 Next 80B A3B — high-intelligence MoE reasoning model.',
    tags: ['qwen', 'reasoning', 'free'],
  },

  // ── Balanced / General ──
  'openrouter/nvidia-nemotron-nano-30b': {
    modelId: 'openrouter/nvidia-nemotron-nano-30b',
    displayName: 'Nemotron Nano 30B',
    provider: 'openrouter',
    providerModelId: 'nvidia/llama-3.1-nemotron-nano-8b-v1:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'balanced',
    description: 'NVIDIA Nemotron Nano 30B — reasoning + instruction following.',
    tags: ['nvidia', 'nemotron', 'free'],
  },

  'openrouter/solar-pro-3': {
    modelId: 'openrouter/solar-pro-3',
    displayName: 'Solar Pro 3',
    provider: 'openrouter',
    providerModelId: 'upstage/solar-pro-3:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'balanced',
    description: 'Upstage Solar Pro 3 — high-quality open model.',
    tags: ['upstage', 'solar', 'free'],
  },

  'openrouter/gpt-oss-120b': {
    modelId: 'openrouter/gpt-oss-120b',
    displayName: 'GPT OSS 120B',
    provider: 'openrouter',
    providerModelId: 'openai/gpt-oss-120b:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'powerful',
    description: 'OpenAI GPT OSS 120B — open-weight powerhouse.',
    tags: ['openai', 'free', 'popular'],
  },

  'openrouter/arcee-trinity-mini': {
    modelId: 'openrouter/arcee-trinity-mini',
    displayName: 'Arcee Trinity Mini',
    provider: 'openrouter',
    providerModelId: 'arcee-ai/arcee-trinity-mini:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: 'Arcee Trinity Mini — lightweight fast free model.',
    tags: ['arcee', 'free', 'fast'],
  },

  'openrouter/nvidia-nemotron-nano-12b': {
    modelId: 'openrouter/nvidia-nemotron-nano-12b',
    displayName: 'Nemotron Nano 12B V2',
    provider: 'openrouter',
    providerModelId: 'nvidia/llama-3.2-nemotron-nano-8b-v1:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'fast',
    description: 'NVIDIA Nemotron Nano 12B V2 — compact and efficient.',
    tags: ['nvidia', 'nemotron', 'free'],
  },

  'openrouter/nvidia-nemotron-nano-9b': {
    modelId: 'openrouter/nvidia-nemotron-nano-9b',
    displayName: 'Nemotron Nano 9B V2',
    provider: 'openrouter',
    providerModelId: 'nvidia/nemotron-nano-9b-v1:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'fast',
    description: 'NVIDIA Nemotron Nano 9B V2 — small, fast, and capable.',
    tags: ['nvidia', 'nemotron', 'free'],
  },

  'openrouter/llama-3.3-70b': {
    modelId: 'openrouter/llama-3.3-70b',
    displayName: 'Llama 3.3 70B Instruct',
    provider: 'openrouter',
    providerModelId: 'meta-llama/llama-3.3-70b-instruct:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'balanced',
    description: 'Meta Llama 3.3 70B — reliable free-tier powerhouse.',
    tags: ['meta', 'llama', 'free', 'popular'],
  },

  'openrouter/gpt-oss-20b': {
    modelId: 'openrouter/gpt-oss-20b',
    displayName: 'GPT OSS 20B',
    provider: 'openrouter',
    providerModelId: 'openai/gpt-oss-20b:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'balanced',
    description: 'OpenAI GPT OSS 20B — fast open-weight model.',
    tags: ['openai', 'free'],
  },

  'openrouter/gemma-3-27b': {
    modelId: 'openrouter/gemma-3-27b',
    displayName: 'Gemma 3 27B',
    provider: 'openrouter',
    providerModelId: 'google/gemma-3-27b-it:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    category: 'balanced',
    description: 'Google Gemma 3 27B via OpenRouter — free, vision-capable.',
    tags: ['google', 'gemma', 'free', 'vision'],
  },

  // ── Liquid AI ──
  'openrouter/lfm2.5-1.2b-thinking': {
    modelId: 'openrouter/lfm2.5-1.2b-thinking',
    displayName: 'LFM 2.5 1.2B Thinking',
    provider: 'openrouter',
    providerModelId: 'liquid/lfm-2.5-mo:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 32768,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'reasoning',
    description: 'LiquidAI LFM 2.5 Thinking — tiny efficient reasoning model.',
    tags: ['liquid', 'free', 'reasoning'],
  },

  'openrouter/lfm2.5-1.2b': {
    modelId: 'openrouter/lfm2.5-1.2b',
    displayName: 'LFM 2.5 1.2B Instruct',
    provider: 'openrouter',
    providerModelId: 'liquid/lfm-2.5-1.2b:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 32768,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: 'LiquidAI LFM 2.5 1.2B — ultra-tiny and super fast.',
    tags: ['liquid', 'free', 'fast', 'tiny'],
  },

  // ── Specialty ──
  'openrouter/venice-uncensored': {
    modelId: 'openrouter/venice-uncensored',
    displayName: 'Venice Uncensored',
    provider: 'openrouter',
    providerModelId: 'venice-ai/venice-uncensored:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 32768,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'balanced',
    description: 'Venice AI Uncensored — unrestricted free model.',
    tags: ['venice', 'free'],
  },

  'openrouter/mistral-small-3.1-24b': {
    modelId: 'openrouter/mistral-small-3.1-24b',
    displayName: 'Mistral Small 3.1 24B',
    provider: 'openrouter',
    providerModelId: 'mistralai/mistral-small-3.1-24b-instruct:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: true,
    isActive: true,
    category: 'balanced',
    description: 'Mistral Small 3.1 24B — vision-capable free tier model.',
    tags: ['mistral', 'free', 'vision'],
  },

  'openrouter/gemma-3n-4b': {
    modelId: 'openrouter/gemma-3n-4b',
    displayName: 'Gemma 3n 4B',
    provider: 'openrouter',
    providerModelId: 'google/gemma-3n-e4b-it:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 8192,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: 'Google Gemma 3n 4B — next-gen efficient architecture.',
    tags: ['google', 'gemma', 'free', 'fast'],
  },

  'openrouter/nous-hermes-3-405b': {
    modelId: 'openrouter/nous-hermes-3-405b',
    displayName: 'Nous Hermes 3 405B',
    provider: 'openrouter',
    providerModelId: 'nousresearch/hermes-3-llama-3.1-405b:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'powerful',
    description: 'Nous Hermes 3 405B — massive open-weight instruction model.',
    tags: ['nous', 'llama', 'free', 'powerful'],
  },

  'openrouter/gemma-3-4b': {
    modelId: 'openrouter/gemma-3-4b',
    displayName: 'Gemma 3 4B',
    provider: 'openrouter',
    providerModelId: 'google/gemma-3-4b-it:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 32768,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: 'Google Gemma 3 4B via OpenRouter — lightweight vision model.',
    tags: ['google', 'gemma', 'free', 'fast'],
  },

  'openrouter/llama-3.2-3b': {
    modelId: 'openrouter/llama-3.2-3b',
    displayName: 'Llama 3.2 3B Instruct',
    provider: 'openrouter',
    providerModelId: 'meta-llama/llama-3.2-3b-instruct:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: 'Meta Llama 3.2 3B — ultra-fast tiny model for quick tasks.',
    tags: ['meta', 'llama', 'free', 'fast'],
  },

  'openrouter/gemma-3-12b': {
    modelId: 'openrouter/gemma-3-12b',
    displayName: 'Gemma 3 12B',
    provider: 'openrouter',
    providerModelId: 'google/gemma-3-12b-it:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 32768,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    category: 'balanced',
    description: 'Google Gemma 3 12B via OpenRouter — solid vision model.',
    tags: ['google', 'gemma', 'free', 'vision'],
  },

  'openrouter/gemma-3n-2b': {
    modelId: 'openrouter/gemma-3n-2b',
    displayName: 'Gemma 3n 2B',
    provider: 'openrouter',
    providerModelId: 'google/gemma-3n-e2b-it:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 8192,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    category: 'fast',
    description: 'Google Gemma 3n 2B — smallest next-gen Gemma variant.',
    tags: ['google', 'gemma', 'free', 'tiny'],
  },

  'openrouter/qwen3-4b': {
    modelId: 'openrouter/qwen3-4b',
    displayName: 'Qwen3 4B',
    provider: 'openrouter',
    providerModelId: 'qwen/qwen3-4b:free',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 40960,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    category: 'fast',
    description: 'Alibaba Qwen3 4B — compact model with tool use.',
    tags: ['qwen', 'free', 'fast'],
  },
};

/**
 * Returns a list of all active models
 */
export function getActiveModelsList(): ModelConfig[] {
  return Object.values(MODEL_REGISTRY).filter((m) => m.isActive);
}

/**
 * Get configuration for a specific model ID
 */
export function getModelConfig(modelId: string): ModelConfig {
  const config = MODEL_REGISTRY[modelId];
  if (!config) throw new Error(`Model ${modelId} not found in gateway registry`);
  return config;
}

/**
 * Calculate credit cost for a request/response pair
 */
export function calculateCredits(
  model: ModelConfig,
  promptTokens: number,
  completionTokens: number,
): number {
  const inputCost = (promptTokens / 1000) * model.inputCreditsPerK;
  const outputCost = (completionTokens / 1000) * model.outputCreditsPerK;
  return Math.ceil(inputCost + outputCost);
}
