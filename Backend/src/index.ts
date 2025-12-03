import { clerkMiddleware } from '@clerk/express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import { serve } from 'inngest/express';
import * as client from 'prom-client';
import swaggerUi from 'swagger-ui-express';
import { ENV } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import { inngest } from './inngest/v1/client.js';
import {
  createLog,
  createOrganizationRoles,
  createReport,
  deleteAllReadNotifications,
  deleteNotifications,
  deleteOrganization,
  deleteUser,
  exportUserDataHandler,
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
import paymentsRouter from './routes/v1/payments.js';
import reportsRouter from './routes/v1/reports.js';
import starsRouter from './routes/v1/stars.js';
import logger from './utils/logger.js';

const app = express();
const PORT = ENV.PORT || 3000;
Sentry.setupExpressErrorHandler(app);

// Security middlewares - relaxed CSP for Swagger UI
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
      },
    },
  }),
);
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

// Swagger API Documentation - Enhanced UI with better styling
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 30px 0 }
      .swagger-ui .scheme-container { background: #fafafa; padding: 15px; border-radius: 4px; margin: 20px 0 }
      .swagger-ui .info .title { font-size: 36px; color: #182837 }
      .swagger-ui .info .description { font-size: 14px; line-height: 1.6 }
      .swagger-ui .opblock-tag { font-size: 18px; font-weight: 600; padding: 10px 20px }
      .swagger-ui .opblock { margin: 0 0 15px; border-radius: 4px }
      .swagger-ui .opblock .opblock-summary { padding: 10px; border-radius: 4px }
      .swagger-ui .btn.authorize { background: #182837; border-color: #182837 }
      .swagger-ui .btn.authorize svg { fill: white }
    `,
    customSiteTitle: 'FairArena API Documentation',
    customfavIcon: 'https://fairarena.vercel.app/fairArenaLogotop.png',
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 3,
      defaultModelExpandDepth: 3,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
      tryItOutEnabled: true,
    },
  }),
);

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

// Payments routes
app.use('/api/v1/payments', paymentsRouter);

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
      exportUserDataHandler,
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

// Serve Swagger UI in development mode
if (ENV.NODE_ENV === 'development') {
  app.get('/api-docs', (_, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

// 404 handler for unmatched routes
app.use((_, res) => {
  logger.info('404 Not Found', { path: _.originalUrl });
  res.status(404).json({ error: { message: 'Not found', status: 404 } });
});

export default app;

// Start the server
if (ENV.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
}
