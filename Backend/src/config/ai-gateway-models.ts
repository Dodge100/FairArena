/**
 * AI Gateway Model Registry
 * All models, their providers, credit costs, and capabilities.
 *
 * Credit Pricing Tiers (per 1,000 tokens):
 *   1  = Economy / nano / tiny models
 *   2  = Standard / mid-size models
 *   3  = Large / powerful models
 *   4  = Premium  (e.g. Gemini Pro, big-context)
 *   5  = Ultra-premium (e.g. DeepSeek R1, 405B, 480B+)
 *
 * NO model is free. Every request costs at least 1 credit.
 */

export type ModelProvider = 'groq' | 'gemini' | 'openrouter';

export interface ProviderMetadata {
  label: string;
  color: string;
  icon: string;
}

export const PROVIDER_METADATA: Record<ModelProvider, ProviderMetadata> = {
  groq: {
    label: 'Groq',
    color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    icon: '⚡',
  },
  gemini: { label: 'Gemini', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: '✦' },
  openrouter: {
    label: 'OpenRouter',
    color: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    icon: '◈',
  },
};

export interface ModelConfig {
  /** Public model ID that users reference in requests */
  modelId: string;
  /** Friendly display name */
  displayName: string;
  /** Underlying provider */
  provider: ModelProvider;
  /** Provider-side model identifier (may differ from modelId) */
  providerModelId: string;
  /** Credits charged per 1,000 input tokens (always >= 1) */
  inputCreditsPerK: number;
  /** Credits charged per 1,000 output tokens (always >= 1) */
  outputCreditsPerK: number;
  /** Maximum context window in tokens */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Whether this model supports streaming */
  supportsStreaming: boolean;
  /** Whether this model supports vision/images */
  supportsVision: boolean;
  /** Whether this model supports function/tool calling natively */
  supportsToolCalling: boolean;
  /** Whether this model is currently available */
  isActive: boolean;
  /** Tags for categorization */
  tags: string[];
  /** Brief description */
  description: string;
}

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // ─── GROQ ─────────────────────────────────────────────────────────────────────
  // GPT-OSS 120B  (OpenAI open-weight via Groq)
  'groq/gpt-oss-120b': {
    modelId: 'groq/gpt-oss-120b',
    displayName: 'GPT OSS 120B',
    provider: 'groq',
    providerModelId: 'openai/gpt-oss-120b',
    inputCreditsPerK: 3,
    outputCreditsPerK: 3,
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['powerful', 'openai', 'moe'],
    description:
      "OpenAI's flagship open-weight MoE model via Groq. High capability for agentic use.",
  },

  // GPT-OSS 20B  (OpenAI open-weight via Groq)
  'groq/gpt-oss-20b': {
    modelId: 'groq/gpt-oss-20b',
    displayName: 'GPT OSS 20B',
    provider: 'groq',
    providerModelId: 'openai/gpt-oss-20b',
    inputCreditsPerK: 1,
    outputCreditsPerK: 2,
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['fast', 'openai', 'moe'],
    description:
      'Compact open-weight MoE from OpenAI via Groq. Optimised for cost-efficient production.',
  },

  // Kimi K2 (Moonshot AI via Groq)
  'groq/kimi-k2': {
    modelId: 'groq/kimi-k2',
    displayName: 'Kimi K2',
    provider: 'groq',
    providerModelId: 'moonshotai/kimi-k2-instruct-0905',
    inputCreditsPerK: 2,
    outputCreditsPerK: 3,
    contextWindow: 256000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['agentic', 'coding', 'tool-use', 'long-context'],
    description:
      'Moonshot AI Kimi K2 via Groq. Excels at tool use, coding, and autonomous reasoning.',
  },

  // Llama 4 Scout (Meta via Groq)
  'groq/llama-4-scout': {
    modelId: 'groq/llama-4-scout',
    displayName: 'Llama 4 Scout',
    provider: 'groq',
    providerModelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    tags: ['fast', 'multimodal', 'vision', 'llama'],
    description: 'Meta Llama 4 Scout 17B via Groq. Multimodal, fast, great for everyday tasks.',
  },

  // Llama 3.3 70B (Meta via Groq)
  'groq/llama-3.3-70b': {
    modelId: 'groq/llama-3.3-70b',
    displayName: 'Llama 3.3 70B',
    provider: 'groq',
    providerModelId: 'llama-3.3-70b-versatile',
    inputCreditsPerK: 2,
    outputCreditsPerK: 2,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['powerful', 'standard', 'llama'],
    description: 'Meta Llama 3.3 70B via Groq. Excellent multilingual reasoning at speed.',
  },

  // ─── GEMINI ───────────────────────────────────────────────────────────────────
  'gemini/gemini-2.0-flash': {
    modelId: 'gemini/gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    provider: 'gemini',
    providerModelId: 'gemini-2.0-flash',
    inputCreditsPerK: 2,
    outputCreditsPerK: 3,
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: true,
    isActive: true,
    tags: ['fast', 'google', 'multimodal', 'latest'],
    description:
      'Gemini 2.0 Flash. Latest generation multimodal model with 1M context and tool calling.',
  },

  'gemini/gemini-2.5-flash': {
    modelId: 'gemini/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'gemini',
    providerModelId: 'gemini-2.5-flash',
    inputCreditsPerK: 3,
    outputCreditsPerK: 4,
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: true,
    isActive: true,
    tags: ['premium', 'google', 'multimodal', 'thinking', 'latest'],
    description:
      'Gemini 2.5 Flash with thinking mode. Best-in-class reasoning and long output for complex tasks.',
  },

  // ─── OPENROUTER ───────────────────────────────────────────────────────────────
  // --- Larger / flagship models ---
  'openrouter/deepseek/deepseek-r1-0528': {
    modelId: 'openrouter/deepseek/deepseek-r1-0528',
    displayName: 'DeepSeek R1 0528',
    provider: 'openrouter',
    providerModelId: 'deepseek/deepseek-r1-0528',
    inputCreditsPerK: 5,
    outputCreditsPerK: 5,
    contextWindow: 163840,
    maxOutputTokens: 32768,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    tags: ['reasoning', 'deepseek', 'flagship'],
    description:
      'DeepSeek R1 0528 update — on-par with OpenAI o1. Open-source state-of-the-art reasoning.',
  },

  'openrouter/nousresearch/hermes-3-llama-3.1-405b': {
    modelId: 'openrouter/nousresearch/hermes-3-llama-3.1-405b',
    displayName: 'Nous Hermes 3 405B',
    provider: 'openrouter',
    providerModelId: 'nousresearch/hermes-3-llama-3.1-405b',
    inputCreditsPerK: 5,
    outputCreditsPerK: 5,
    contextWindow: 131072,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['powerful', 'hermes', 'llama', 'agents'],
    description:
      'Nous Research Hermes 3 on Llama 3.1 405B. Best-in-class open model for agents and tools.',
  },

  'openrouter/meta-llama/llama-4-scout': {
    modelId: 'openrouter/meta-llama/llama-4-scout',
    displayName: 'Llama 4 Scout (OR)',
    provider: 'openrouter',
    providerModelId: 'meta-llama/llama-4-scout',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    tags: ['fast', 'multimodal', 'llama'],
    description: 'Meta Llama 4 Scout via OpenRouter. Fast multimodal model.',
  },

  // --- Qwen3 ---
  'openrouter/qwen/qwen3-coder-480b-a35b': {
    modelId: 'openrouter/qwen/qwen3-coder-480b-a35b',
    displayName: 'Qwen3 Coder 480B',
    provider: 'openrouter',
    providerModelId: 'qwen/qwen3-coder-480b-a35b',
    inputCreditsPerK: 5,
    outputCreditsPerK: 5,
    contextWindow: 256000,
    maxOutputTokens: 32768,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['coding', 'qwen', 'flagship', 'moe'],
    description: "Qwen3 Coder 480B — Alibaba's state-of-the-art coding MoE via OpenRouter.",
  },

  'openrouter/qwen/qwen3-next-80b-a3b-instruct': {
    modelId: 'openrouter/qwen/qwen3-next-80b-a3b-instruct',
    displayName: 'Qwen3 Next 80B',
    provider: 'openrouter',
    providerModelId: 'qwen/qwen3-next-80b-a3b-instruct',
    inputCreditsPerK: 2,
    outputCreditsPerK: 3,
    contextWindow: 131072,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['powerful', 'qwen', 'moe'],
    description: 'Qwen3 Next 80B A3B Instruct. Powerful sparse MoE for reasoning and tool use.',
  },

  'openrouter/qwen/qwen3-4b': {
    modelId: 'openrouter/qwen/qwen3-4b',
    displayName: 'Qwen3 4B',
    provider: 'openrouter',
    providerModelId: 'qwen/qwen3-4b',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['economy', 'qwen', 'fast'],
    description:
      'Qwen3 4B — lightweight and fast. Ideal for high-volume tasks requiring tool calling.',
  },

  // --- OpenAI OSS ---
  'openrouter/openai/gpt-oss-120b': {
    modelId: 'openrouter/openai/gpt-oss-120b',
    displayName: 'GPT OSS 120B (OR)',
    provider: 'openrouter',
    providerModelId: 'openai/gpt-oss-120b',
    inputCreditsPerK: 3,
    outputCreditsPerK: 3,
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['openai', 'moe', 'powerful'],
    description:
      "OpenAI's 117B open-weight MoE model via OpenRouter. High capability production inference.",
  },

  'openrouter/openai/gpt-oss-20b': {
    modelId: 'openrouter/openai/gpt-oss-20b',
    displayName: 'GPT OSS 20B (OR)',
    provider: 'openrouter',
    providerModelId: 'openai/gpt-oss-20b',
    inputCreditsPerK: 1,
    outputCreditsPerK: 2,
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['openai', 'moe', 'fast', 'economy'],
    description: "OpenAI's 21B open-weight MoE via OpenRouter. Low latency agentic workflows.",
  },

  // --- Meta Llama ---
  'openrouter/meta-llama/llama-3.3-70b-instruct': {
    modelId: 'openrouter/meta-llama/llama-3.3-70b-instruct',
    displayName: 'Llama 3.3 70B Instruct',
    provider: 'openrouter',
    providerModelId: 'meta-llama/llama-3.3-70b-instruct',
    inputCreditsPerK: 2,
    outputCreditsPerK: 2,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['powerful', 'llama', 'standard'],
    description: 'Meta Llama 3.3 70B Instruct via OpenRouter. Excellent multilingual model.',
  },

  'openrouter/meta-llama/llama-3.2-3b-instruct': {
    modelId: 'openrouter/meta-llama/llama-3.2-3b-instruct',
    displayName: 'Llama 3.2 3B Instruct',
    provider: 'openrouter',
    providerModelId: 'meta-llama/llama-3.2-3b-instruct',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    tags: ['economy', 'llama', 'tiny'],
    description: 'Meta Llama 3.2 3B via OpenRouter. Ultra-low cost for simple tasks.',
  },

  'openrouter/meta-llama/llama-3.1-405b': {
    modelId: 'openrouter/meta-llama/llama-3.1-405b',
    displayName: 'Llama 3.1 405B Base',
    provider: 'openrouter',
    providerModelId: 'meta-llama/llama-3.1-405b',
    inputCreditsPerK: 5,
    outputCreditsPerK: 5,
    contextWindow: 131072,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    tags: ['powerful', 'llama', 'base'],
    description:
      'Meta Llama 3.1 405B base model via OpenRouter. Massive capacity for demanding tasks.',
  },

  // --- Kimi K2 (OpenRouter) ---
  'openrouter/moonshotai/kimi-k2': {
    modelId: 'openrouter/moonshotai/kimi-k2',
    displayName: 'Kimi K2 (OR)',
    provider: 'openrouter',
    providerModelId: 'moonshotai/kimi-k2',
    inputCreditsPerK: 2,
    outputCreditsPerK: 3,
    contextWindow: 131072,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['agentic', 'coding', 'tool-use'],
    description:
      'Moonshot AI Kimi K2 via OpenRouter. Strong tool use, coding, and agentic reasoning.',
  },

  // --- Mistral ---
  'openrouter/mistralai/mistral-small-3.1-24b-instruct': {
    modelId: 'openrouter/mistralai/mistral-small-3.1-24b-instruct',
    displayName: 'Mistral Small 3.1 24B',
    provider: 'openrouter',
    providerModelId: 'mistralai/mistral-small-3.1-24b-instruct',
    inputCreditsPerK: 1,
    outputCreditsPerK: 2,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: true,
    isActive: true,
    tags: ['standard', 'mistral', 'multimodal'],
    description: 'Mistral Small 3.1 24B via OpenRouter. Multimodal with 128k context. Apache 2.0.',
  },

  // --- Google Gemma (via OpenRouter) ---
  'openrouter/google/gemma-3-27b-it': {
    modelId: 'openrouter/google/gemma-3-27b-it',
    displayName: 'Gemma 3 27B',
    provider: 'openrouter',
    providerModelId: 'google/gemma-3-27b-it',
    inputCreditsPerK: 2,
    outputCreditsPerK: 2,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    tags: ['google', 'vision', 'gemma'],
    description: 'Google Gemma 3 27B instruction-tuned via OpenRouter. Multimodal and efficient.',
  },

  'openrouter/google/gemma-3-12b-it': {
    modelId: 'openrouter/google/gemma-3-12b-it',
    displayName: 'Gemma 3 12B',
    provider: 'openrouter',
    providerModelId: 'google/gemma-3-12b-it',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    tags: ['google', 'vision', 'gemma'],
    description: 'Google Gemma 3 12B instruction-tuned via OpenRouter. Multimodal compact model.',
  },

  'openrouter/google/gemma-3-4b-it': {
    modelId: 'openrouter/google/gemma-3-4b-it',
    displayName: 'Gemma 3 4B',
    provider: 'openrouter',
    providerModelId: 'google/gemma-3-4b-it',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    tags: ['economy', 'google', 'vision', 'gemma'],
    description: 'Google Gemma 3 4B instruction-tuned via OpenRouter. Tiny and multimodal.',
  },

  'openrouter/google/gemma-3n-e4b-it': {
    modelId: 'openrouter/google/gemma-3n-e4b-it',
    displayName: 'Gemma 3n 4B',
    provider: 'openrouter',
    providerModelId: 'google/gemma-3n-e4b-it',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 32768,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    tags: ['economy', 'google', 'multimodal', 'mobile'],
    description:
      'Google Gemma 3n 4B — designed for on-device/mobile inference. Low cost multimodal.',
  },

  'openrouter/google/gemma-3n-e2b-it': {
    modelId: 'openrouter/google/gemma-3n-e2b-it',
    displayName: 'Gemma 3n 2B',
    provider: 'openrouter',
    providerModelId: 'google/gemma-3n-e2b-it',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 32768,
    maxOutputTokens: 2048,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    tags: ['economy', 'google', 'multimodal', 'mobile', 'tiny'],
    description: 'Google Gemma 3n 2B — ultra-compact multimodal model for mobile deployment.',
  },

  // --- NVIDIA ---
  'openrouter/nvidia/llama-3.3-nemotron-super-49b-v1': {
    modelId: 'openrouter/nvidia/llama-3.3-nemotron-super-49b-v1',
    displayName: 'Nemotron 3 Nano 30B',
    provider: 'openrouter',
    providerModelId: 'nvidia/llama-3.3-nemotron-super-49b-v1',
    inputCreditsPerK: 2,
    outputCreditsPerK: 2,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['nvidia', 'agentic', 'moe'],
    description: 'NVIDIA Nemotron 3 Nano 30B A3B. Open MoE model for specialised agentic AI.',
  },

  'openrouter/nvidia/nemotron-nano-12b-v1': {
    modelId: 'openrouter/nvidia/nemotron-nano-12b-v1',
    displayName: 'Nemotron Nano 12B V1',
    provider: 'openrouter',
    providerModelId: 'nvidia/nemotron-nano-12b-v1',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsToolCalling: false,
    isActive: true,
    tags: ['nvidia', 'vision', 'standard'],
    description: 'NVIDIA Nemotron Nano 12B V2 VL via OpenRouter. Compact vision-language model.',
  },

  'openrouter/nvidia/nemotron-nano-9b-v2': {
    modelId: 'openrouter/nvidia/nemotron-nano-9b-v2',
    displayName: 'Nemotron Nano 9B V2',
    provider: 'openrouter',
    providerModelId: 'nvidia/nemotron-nano-9b-v2',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['nvidia', 'reasoning', 'fast'],
    description:
      'NVIDIA Nemotron Nano 9B V2. Unified reasoning/non-reasoning model trained from scratch.',
  },

  // --- Arcee ---
  'openrouter/arcee-ai/arcee-nova': {
    modelId: 'openrouter/arcee-ai/arcee-nova',
    displayName: 'Arcee Trinity Large',
    provider: 'openrouter',
    providerModelId: 'arcee-ai/arcee-nova',
    inputCreditsPerK: 3,
    outputCreditsPerK: 4,
    contextWindow: 131072,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['arcee', 'agentic', 'moe', 'powerful'],
    description: 'Arcee AI Trinity Large Preview — 400B sparse MoE for advanced agentic workflows.',
  },

  'openrouter/arcee-ai/arcee-spark': {
    modelId: 'openrouter/arcee-ai/arcee-spark',
    displayName: 'Arcee Trinity Mini',
    provider: 'openrouter',
    providerModelId: 'arcee-ai/arcee-spark',
    inputCreditsPerK: 1,
    outputCreditsPerK: 2,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['arcee', 'fast', 'moe', 'agents'],
    description:
      'Arcee AI Trinity Mini — 26B sparse MoE for efficient long-context reasoning and function calling.',
  },

  // --- Upstage ---
  'openrouter/upstage/solar-pro-preview': {
    modelId: 'openrouter/upstage/solar-pro-preview',
    displayName: 'Solar Pro 3',
    provider: 'openrouter',
    providerModelId: 'upstage/solar-pro-preview',
    inputCreditsPerK: 2,
    outputCreditsPerK: 2,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    tags: ['upstage', 'standard'],
    description: 'Upstage Solar Pro 3 via OpenRouter. Capable general-purpose model.',
  },

  // --- StepFun ---
  'openrouter/stepfun-ai/step-3.5-flash': {
    modelId: 'openrouter/stepfun-ai/step-3.5-flash',
    displayName: 'Step 3.5 Flash',
    provider: 'openrouter',
    providerModelId: 'stepfun-ai/step-3.5-flash',
    inputCreditsPerK: 2,
    outputCreditsPerK: 2,
    contextWindow: 256000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    tags: ['reasoning', 'stepfun', 'fast', 'moe'],
    description:
      "StepFun's flagship reasoning MoE model. Fast with 256k context, ideal for agentic tasks.",
  },

  // --- LiquidAI ---
  'openrouter/liquid/lfm2-1_2b-thinking': {
    modelId: 'openrouter/liquid/lfm2-1_2b-thinking',
    displayName: 'LFM2.5 1.2B Thinking',
    provider: 'openrouter',
    providerModelId: 'liquid/lfm2-1_2b-thinking',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 32768,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    tags: ['liquid', 'tiny', 'reasoning', 'economy'],
    description: 'LiquidAI LFM2.5 1.2B Thinking. Ultra-compact reasoning model at minimal cost.',
  },

  'openrouter/liquid/lfm2-1_2b': {
    modelId: 'openrouter/liquid/lfm2-1_2b',
    displayName: 'LFM2.5 1.2B Instruct',
    provider: 'openrouter',
    providerModelId: 'liquid/lfm2-1_2b',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 32768,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    tags: ['liquid', 'tiny', 'economy'],
    description: 'LiquidAI LFM2.5 1.2B Instruct. Smallest practical conversational model.',
  },

  // --- Z.ai ---
  'openrouter/z-ai/glm-4.5-air': {
    modelId: 'openrouter/z-ai/glm-4.5-air',
    displayName: 'GLM 4.5 Air',
    provider: 'openrouter',
    providerModelId: 'z-ai/glm-4.5-air',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    isActive: true,
    tags: ['z-ai', 'fast', 'economy'],
    description: 'Z.ai GLM 4.5 Air via OpenRouter. Lightweight model with tool calling support.',
  },

  // --- AlfredPros (Coding specialised) ---
  'openrouter/alfredpros/codellama-7b-instruct-solidity': {
    modelId: 'openrouter/alfredpros/codellama-7b-instruct-solidity',
    displayName: 'CodeLLaMa 7B Solidity',
    provider: 'openrouter',
    providerModelId: 'alfredpros/codellama-7b-instruct-solidity',
    inputCreditsPerK: 1,
    outputCreditsPerK: 1,
    contextWindow: 16384,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    isActive: true,
    tags: ['coding', 'solidity', 'blockchain', 'specialized'],
    description:
      'CodeLLaMa 7B fine-tuned on Solidity by AlfredPros. Ideal for smart contract development.',
  },
};

// ─── Utility Functions ────────────────────────────────────────────────────────

/** Get a model config by ID */
export function getModelConfig(modelId: string): ModelConfig | null {
  return MODEL_REGISTRY[modelId] ?? null;
}

/** Calculate credits for a request. Always at least 1 credit for paid requests. */
export function calculateCredits(
  model: ModelConfig,
  promptTokens: number,
  completionTokens: number,
): number {
  const inputCost = Math.ceil((promptTokens / 1000) * model.inputCreditsPerK);
  const outputCost = Math.ceil((completionTokens / 1000) * model.outputCreditsPerK);
  const total = inputCost + outputCost;
  // Minimum 1 credit per request (all models are paid)
  return Math.max(total, 1);
}

/** Get all active models as a flat typed array */
export function getActiveModelsList(): ModelConfig[] {
  return Object.values(MODEL_REGISTRY).filter((m) => m.isActive);
}

/** Get all active models grouped by provider */
export function getActiveModels(): Record<ModelProvider, ModelConfig[]> {
  const result: Record<ModelProvider, ModelConfig[]> = {
    groq: [],
    gemini: [],
    openrouter: [],
  };
  for (const model of Object.values(MODEL_REGISTRY)) {
    if (model.isActive) {
      result[model.provider].push(model);
    }
  }
  return result;
}
