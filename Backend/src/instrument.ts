// Import OpenTelemetry tracing FIRST to ensure proper instrumentation
import * as Sentry from '@sentry/node';
import './tracing.js';

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  sendDefaultPii: true,
});
