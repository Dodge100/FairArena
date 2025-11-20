import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import { serve } from 'inngest/express';
import * as client from 'prom-client';
import { ENV } from './config/env.js';
import { inngest } from './inngest/v1/client.js';
import { syncUser, updateUser, deleteUser } from './inngest/v1/index.js';
import { arcjetMiddleware } from './middleware/arcjet.middleware.js';
import webhookRouter from './routes/v1/webhook.js';

const app = express();
const PORT = ENV.PORT || 3000;

// Security middlewares
app.use(helmet());
app.use(hpp());
app.set('trust proxy', 1);

// CORS middleware
app.use(cors({
  origin: ENV.NODE_ENV === 'production' ? 'https://fairarena.vercel.app' : 'http://localhost:5173',
  credentials: true
}));

// Webhook routes
app.use('/webhooks/v1', webhookRouter);

// JSON middleware
app.use(express.json());

// Prometheus metrics setup
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// Arcjet middleware for security
app.use(arcjetMiddleware);

// Inngest serve
app.use('/api/inngest', serve({ client: inngest, functions: [syncUser, updateUser, deleteUser] }));

// Metrics endpoint
app.get('/metrics', async (_, res) => {
  res.setHeader('Content-Type', client.register.contentType);
  const metrics = await client.register.metrics();
  res.send(metrics);
});

// Health check endpoint
app.get('/healthz', (_, res) => {
  res.status(200).send('Server is healthy...');
});

// 404 handler for unmatched routes
app.use((_, res) => {
  res.status(404).json({ error: { message: 'Not found', status: 404 } });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
