import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import { ENV } from './config/env.js';
import * as client from 'prom-client';
import { arcjetMiddleware } from './middleware/arcjet.middleware.js';

const app = express();
const PORT = ENV.PORT || 3000;

// Security middlewares
app.use(helmet());
app.use(hpp());
app.set('trust proxy', 1);

// CORS middleware
app.use(cors());

// JSON middleware
app.use(express.json());

// Prometheus metrics setup
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// Arcjet middleware for security
app.use(arcjetMiddleware);

// Metrics endpoint
app.get('/metrics', async (_, res) => {
  res.setHeader('Content-Type', client.register.contentType);
  const metrics = await client.register.metrics();
  res.send(metrics);
});

app.get('/healthz', (_, res) => {
  res.status(200).send('Server is healthy...');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
