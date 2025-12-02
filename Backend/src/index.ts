import { clerkMiddleware } from '@clerk/express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import { serve } from 'inngest/express';
import * as client from 'prom-client';
import { ENV } from './config/env.js';
import { inngest } from './inngest/v1/client.js';
import {
  createLog,
  createOrganizationRoles,
  createReport,
  deleteAllReadNotifications,
  deleteNotifications,
  deleteOrganization,
  deleteUser,
  inviteToPlatform,
  markAllNotificationsAsRead,
  markNotificationsAsRead,
  markNotificationsAsUnread,
  recordProfileView,
  sendEmailHandler,
  sendOtpForAccountSettings,
  starProfile,
  subscribeToNewsletter,
  syncUser,
  unstarProfile,
  unsubscribeFromNewsletter,
  updateOrganization,
  updateProfileFunction,
  updateUser,
} from './inngest/v1/index.js';
import { arcjetMiddleware } from './middleware/arcjet.middleware.js';
import { maintenanceMiddleware } from './middleware/maintenance.middleware.js';
import accountSettingsRouter from './routes/v1/account-settings.js';
import aiRouter from './routes/v1/ai.routes.js';
import newsletterRouter from './routes/v1/newsletter.js';
import platformInviteRouter from './routes/v1/platformInvite.js';
import profileRouter from './routes/v1/profile.js';
import webhookRouter from './routes/v1/webhook.js';
// import teamRouter from './routes/v1/team.js';
import * as Sentry from '@sentry/node';
import './instrument.js';
import cleanupRouter from './routes/v1/cleanup.js';
import notificationRouter from './routes/v1/notification.routes.js';
import organizationRouter from './routes/v1/organization.js';
import reportsRouter from './routes/v1/reports.js';
import starsRouter from './routes/v1/stars.js';
import logger from './utils/logger.js';

const app = express();
const PORT = ENV.PORT || 3000;
Sentry.setupExpressErrorHandler(app);

// Security middlewares
app.use(helmet());
app.use(hpp());
app.set('trust proxy', 1);

// CORS middleware (enhanced for production multi-origin + preflight)
const allowedOrigins = [
  ENV.FRONTEND_URL,
  ENV.NODE_ENV === 'development' && 'http://localhost:5173',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);

      logger.warn('CORS blocked origin', { origin });
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'ip.src',
      'X-Recaptcha-Token',
      'X-Clerk-Auth',
      'X-Requested-With',
    ],
    credentials: true,
  }),
);

// Clerk middleware
app.use(clerkMiddleware({ secretKey: ENV.CLERK_SECRET_KEY }));

// Webhook routes
app.use('/webhooks/v1', webhookRouter);

// JSON middleware
app.use(express.json());

// Cookie parser middleware
app.use(cookieParser());

// Prometheus metrics setup
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// Arcjet middleware for security
{
  ENV.NODE_ENV === 'production' && app.use(arcjetMiddleware);
}

// Maintenance mode middleware (check before all API routes)
app.use(maintenanceMiddleware);

// Profile routes
app.use('/api/v1/profile', profileRouter);

// Account settings routes
app.use('/api/v1/account-settings', accountSettingsRouter);

// Newsletter routes
app.use('/api/v1/newsletter', newsletterRouter);

// Platform invite routes
app.use('/api/v1/platform', platformInviteRouter);

// Team routes
// app.use('/api/v1/team', teamRouter);

// Organization routes
app.use('/api/v1/organization', organizationRouter);

// Report route
app.use('/api/v1/reports', reportsRouter);

// Stars routes
app.use('/api/v1/stars', starsRouter);

// Notification routes
app.use('/api/v1/notifications', notificationRouter);

// AI Assistant routes
app.use('/api/v1/ai', aiRouter);

// Cleanup routes
app.use('/api/v1', cleanupRouter);

// Inngest serve
app.use(
  '/api/inngest',
  serve({
    client: inngest,
    functions: [
      syncUser,
      updateUser,
      deleteUser,
      sendOtpForAccountSettings,
      createLog,
      updateProfileFunction,
      recordProfileView,
      subscribeToNewsletter,
      unsubscribeFromNewsletter,
      inviteToPlatform,
      createOrganizationRoles,
      deleteOrganization,
      updateOrganization,
      createReport,
      starProfile,
      unstarProfile,
      sendEmailHandler,
      // Notification async operations
      markNotificationsAsRead,
      markNotificationsAsUnread,
      markAllNotificationsAsRead,
      deleteNotifications,
      deleteAllReadNotifications,
    ],
  }),
);

// Metrics endpoint
app.get('/metrics', async (_, res) => {
  res.setHeader('Content-Type', client.register.contentType);
  const metrics = await client.register.metrics();
  res.send(metrics);
});

// Health check endpoint
app.get('/healthz', (req, res) => {
  logger.info('Health check ping received', { ip: req.ip });
  res.status(200).send('Server is healthy...');
});

// 404 handler for unmatched routes
app.use((_, res) => {
  logger.info('404 Not Found');
  res.status(404).json({ error: { message: 'Not found', status: 404 } });
});

export default app;

// Start the server
if (ENV.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
}
