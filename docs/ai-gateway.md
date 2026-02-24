# 🤖 FairArena AI Gateway

The FairArena AI Gateway is a high-performance, OpenAI-compatible interface that allows developers to access frontier AI models from multiple providers (Groq, Google Gemini, OpenRouter, Cloudflare) through a single, unified API.

Designed for transparency and efficiency, the gateway provides built-in credit management, response caching, and advanced observability.

---

## 🚀 Quick Start

### 1. Base URL

All API requests should be made to:
`http://localhost:3000/v1`

### 2. Authentication

FairArena uses API Keys for authentication. You can generate a key in your dashboard. Include it in the `Authorization` header of every request:

```bash
Authorization: Bearer fa_live_...
```

### 3. Basic Request (OpenAI SDK)

The gateway is fully compatible with the official OpenAI SDKs.

```javascript
import OpenAI from 'openai';

const fairarena = new OpenAI({
  apiKey: 'YOUR_API_KEY',
  baseURL: 'http://localhost:3000/v1',
});

const response = await fairarena.chat.completions.create({
  model: 'groq/llama-3.3-70b',
  messages: [{ role: 'user', content: 'Explain FairArena in one sentence.' }],
});

console.log(response.choices[0].message.content);
```

---

## 🗺️ Model Registry

FairArena uses a **prefixed ID** system to identify models and their providers.

| Prefix        | Provider                                                    | Highlights                                      |
| :------------ | :---------------------------------------------------------- | :---------------------------------------------- |
| `groq/`       | [Groq](https://groq.com)                                    | Ultra-low latency LPU inference.                |
| `gemini/`     | [Google Gemini](https://ai.google.dev)                      | Massive 1M+ context windows and vision.         |
| `openrouter/` | [OpenRouter](https://openrouter.ai)                         | Access to frontier models with unified billing. |
| `cloudflare/` | [Cloudflare](https://developers.cloudflare.com/workers-ai/) | Edge inference with high availability.          |

### Listing Models

To see all available models, costs, and capabilities:
`GET /models`

---

## 🛠️ API Reference

### Chat Completions

`POST /chat/completions`

Standard OpenAI parameters (`messages`, `model`, `stream`, `temperature`, `max_tokens`, etc.) are fully supported.

#### Custom Parameters (FairArena Specific)

| Parameter   | Type      | Default | Description                                                       |
| :---------- | :-------- | :------ | :---------------------------------------------------------------- |
| `cache`     | `boolean` | `true`  | Enable/disable semantic response caching (ignored for streaming). |
| `cache_ttl` | `number`  | `300`   | Time-to-live for the cached response in seconds (max 3600).       |

#### Response Metadata

Every successful non-streaming response includes a `x_fairarena` object containing billing and performance data:

```json
{
  "id": "chatcmpl-...",
  "choices": [...],
  "usage": { "prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30 },
  "x_fairarena": {
    "credits_used": 1,
    "cached": false,
    "latency_ms: 450,
    "model_info": {
      "provider": "groq",
      "context_window": 128000
    }
  }
}
```

---

## ⚡ Advanced Features

### 📡 Streaming

Streaming is supported for most models. When `stream: true` is provided, the gateway returns a standard Server-Sent Events (SSE) stream.

**Pro-Tip**: The gateway sends a final metadata chunk containing the `x_fairarena` object before the `[DONE]` signal.

### 🔧 Tool Calling (Function Calling)

Pass a list of tools to the model. For models that do not natively support tool calling (like some community models on Groq/Cloudflare), FairArena provides **automatic fallback emulation** by injecting a specialized system prompt and parsing blocks.

```javascript
tools: [{
  type: 'function',
  function: {
    name: 'get_weather',
    parameters: { ... }
  }
}]
```

### 📦 Response Caching

By default, the gateway caches identical requests for 5 minutes. This saves both **latency** and **credits**. Cached responses do not charge any credits.

---

## 💳 Credit Management & Security

### Transparency

Costs are calculated based on the specific model's `inputCreditsPerK` and `outputCreditsPerK` rates.

### One-Time Notifications

- **Low Credits**: You will receive a one-time email warning when your balance drops below **500 credits**. This flag is reset automatically once you top up.
- **Redemption**: Upon successful coupon redemption, you'll receive an itemized confirmation email showing your new balance.

### Rate Limits

- **Free/Standard Tier**: 60 requests per minute (RPM).
- **Enterprise**: Contact support for custom throughput.

---

## 🚩 Error Handling

| Code  | Type               | Meaning                                                              |
| :---- | :----------------- | :------------------------------------------------------------------- |
| `401` | `Unauthorized`     | Invalid API Key.                                                     |
| `402` | `Payment Required` | Insufficient credits to complete the request.                        |
| `404` | `Not Found`        | Model ID not found in registry.                                      |
| `429` | `Rate Limit`       | Too many requests in the last minute.                                |
| `502` | `Provider Error`   | The underlying AI provider (e.g. Groq) is down or returned an error. |

---

<p align="center">
  <sub>Built for Developers by the FairArena Team</sub>
</p>
