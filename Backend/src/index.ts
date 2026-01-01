import * as Sentry from '@sentry/node';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import { serve } from 'inngest/express';
import * as client from 'prom-client';
import swaggerUi from 'swagger-ui-express';
import { ENV } from './config/env.js';
import { getReadOnlyPrisma } from './config/read-only.database.js';
import { redis } from './config/redis.js';
import { initSocket } from './config/socket.js';
import { swaggerSpec } from './config/swagger.js';
import { inngest } from './inngest/v1/client.js';
import {
  createLog,
  createOrganizationAuditLog,
  createReport,
  createTeamAuditLog,
  createTeamFunction,
  createUserSettingsFunction,
  creditsSendSmsOtp,
  creditsSendVoiceOtp,
  dailyCleanup,
  deleteAllReadNotifications,
  deleteNotifications,
  deleteOrganization,
  deleteTeamFunction,
  deleteUser,
  exportUserDataHandler,
  inviteToPlatform,
  markAllNotificationsAsRead,
  markNotificationsAsRead,
  markNotificationsAsUnread,
  paymentOrderCreated,
  paymentVerified,
  paymentWebhookReceived,
  processBulkTeamInvites,
  processFeedbackSubmission,
  processSingleTeamInvite,
  processTeamInviteAcceptance,
  recordProfileView,
  resetSettingsFunction,
  sendEmailHandler,
  sendEmailVerification,
  sendLoginNotification,
  sendNotification,
  sendOtpForAccountSettings,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendTeamInviteEmail,
  sendWeeklyFeedbackEmail,
  starProfile,
  subscribeToNewsletter,
  supportRequestCreated,
  syncUser,
  unstarProfile,
  unsubscribeFromNewsletter,
  updateOrganization,
  updateProfileFunction,
  updateSettingsFunction,
  updateTeamFunction,
  updateUser,
} from './inngest/v1/index.js';
import './instrument.js';
import { arcjetMiddleware } from './middleware/arcjet.middleware.js';
import { maintenanceMiddleware } from './middleware/maintenance.middleware.js';
import accountSettingsRouter from './routes/v1/account-settings.js';
import aiRouter from './routes/v1/ai.routes.js';
import authRouter from './routes/v1/auth.routes.js';
import creditsRouter from './routes/v1/credits.js';
import feedbackRouter from './routes/v1/feedback.js';
import newsletterRouter from './routes/v1/newsletter.js';
import notificationRouter from './routes/v1/notification.routes.js';
import organizationRouter from './routes/v1/organization.js';
import paymentsRouter from './routes/v1/payments.js';
import plansRouter from './routes/v1/plans.js';
import platformInviteRouter from './routes/v1/platformInvite.js';
import profileRouter from './routes/v1/profile.js';
import reportsRouter from './routes/v1/reports.js';
import settingsRouter from './routes/v1/settings.js';
import starsRouter from './routes/v1/stars.js';
import supportRouter from './routes/v1/support.js';
import teamRouter from './routes/v1/team.js';
import waitlistRouter from './routes/v1/waitlist.routes.js';
import mfaRouter from './routes/v1/mfa.routes.js';
import webhookRouter from './routes/v1/webhook.js';
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
app.set('trust proxy', true);

const originRegex = new RegExp(
  `^https://(${ENV.CORS_URL.replace('.', '\\.')}|[a-z0-9-]+\\.${ENV.CORS_URL.replace('.', '\\.')})$`,
  'i',
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
      if (!origin) return callback(null, true);

      if (originRegex.test(origin) || ENV.NODE_ENV === 'development') {
        return callback(null, true);
      }

      logger.warn('CORS blocked origin', { origin });
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'ip.src',
      'X-Recaptcha-Token',
      'X-Requested-With',
    ],
    credentials: true,
  }),
);

// Webhook routes (must be before JSON middleware for raw body parsing)
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

// Swagger API Documentation - Only enabled in non-production environments
if (ENV.NODE_ENV !== 'production') {
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
      customfavIcon: 'https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png',
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
}

// Authentication routes (public)
app.use('/api/v1/auth', authRouter);

// Profile routes
app.use('/api/v1/profile', profileRouter);

// Account settings routes
app.use('/api/v1/account-settings', accountSettingsRouter);

// Newsletter routes
app.use('/api/v1/newsletter', newsletterRouter);

// Waitlist routes (public)
app.use('/api/v1/waitlist', waitlistRouter);

// MFA routes (authenticated)
app.use('/api/v1/mfa', mfaRouter);

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

// Payments routes
app.use('/api/v1/payments', paymentsRouter);

// Plans routes
app.use('/api/v1/plans', plansRouter);

// Credits routes
app.use('/api/v1/credits', creditsRouter);

// Settings routes
app.use('/api/v1/settings', settingsRouter);

// Feedback routes
app.use('/api/v1/feedback', feedbackRouter);

// Support router
app.use('/api/v1/support', supportRouter);

// Team routes
app.use('/api/v1/team', teamRouter);

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
      deleteOrganization,
      updateOrganization,
      createReport,
      dailyCleanup,
      starProfile,
      unstarProfile,
      sendEmailHandler,
      sendWeeklyFeedbackEmail,
      exportUserDataHandler,
      markNotificationsAsRead,
      markNotificationsAsUnread,
      markAllNotificationsAsRead,
      deleteNotifications,
      deleteAllReadNotifications,
      paymentOrderCreated,
      paymentVerified,
      paymentWebhookReceived,
      sendNotification,
      updateSettingsFunction,
      resetSettingsFunction,
      createUserSettingsFunction,
      processFeedbackSubmission,
      supportRequestCreated,
      createOrganizationAuditLog,
      sendTeamInviteEmail,
      createTeamAuditLog,
      processSingleTeamInvite,
      processBulkTeamInvites,
      processTeamInviteAcceptance,
      createTeamFunction,
      creditsSendSmsOtp,
      updateTeamFunction,
      deleteTeamFunction,
      creditsSendVoiceOtp,
      sendEmailVerification,
      sendLoginNotification,
      sendPasswordChangedEmail,
      sendPasswordResetEmail,
    ],
  }),
);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', client.register.contentType);
  const allowedIp = '52.175.121.25';

  const ip = req.socket.remoteAddress || req.connection.remoteAddress;

  if (!ip || !ip.includes(allowedIp)) {
    return res.status(403).send('Forbidden');
  }
  const metrics = await client.register.metrics();
  res.send(metrics);
});

// Health check endpoint
app.get('/healthz', async (req, res) => {
  const headerName = ENV.HEALTHZ_HEADER_NAME;
  const headerValue = ENV.HEALTHZ_HEADER_VALUE;

  if (headerName && headerValue) {
    const provided = req.header(headerName);
    if (!provided) {
      logger.warn('Health check header missing', { headerName, ip: req.ip });
      res.status(401).send('Unauthorized');
      return;
    }

    if (provided !== headerValue) {
      logger.warn('Invalid health check header value', { headerName, ip: req.ip });
      res.status(401).send('Unauthorized');
      return;
    }
    logger.info('Health check ping received (header auth)', { ip: req.ip });
  } else {
    // If headers not configured and not internal, deny
    logger.warn('Health check header auth not configured; denying access', { ip: req.ip });
    res.status(503).send('Health check credentials not configured');
    return;
  }

  // Perform actual health checks for internal or if headers are configured
  try {
    // Check database connection
    await getReadOnlyPrisma().$queryRaw`SELECT 1`;

    // Check Redis connection
    await redis.ping();

    res.status(200).send('Server is healthy');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Health check failed', { error: errorMessage });
    res.status(503).send(`Server is unhealthy: ${errorMessage}`);
  }
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

// Global error handler for uncaught errors
app.use((err: unknown, req: express.Request, res: express.Response) => {
  let errorMessage = 'Unknown error';
  let errorStack = undefined;

  if (err instanceof Error) {
    errorMessage = err.message;
    errorStack = err.stack;
  } else if (typeof err === 'string') {
    errorMessage = err;
  }

  logger.error('Unhandled error', {
    error: errorMessage,
    stack: errorStack,
    url: req.url,
    method: req.method,
  });
  res.status(500).json({ error: { message: 'Internal Server Error', status: 500 } });
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Start the server
const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

initSocket(server);
