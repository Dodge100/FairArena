import * as api from '@opentelemetry/api';
import https from 'https';
import { createLogger, format, transports } from 'winston';
import Transport from 'winston-transport';

// Better Stack logging configuration
const BETTER_STACK_CONFIG = {
  url: process.env.BETTER_STACK_URL!,
  token: process.env.BETTER_STACK_TOKEN!,
};

// Custom transport for Better Stack
class BetterStackTransport extends Transport {
  constructor() {
    super({
      format: format.combine(format.timestamp(), format.json()),
    });
  }

  log(info: Record<string, unknown>, callback: () => void) {
    const logEntry = {
      dt: new Date().toISOString(),
      message: info.message,
      level: info.level,
      ...info,
    };

    const data = JSON.stringify(logEntry);

    const options = {
      hostname: new URL(BETTER_STACK_CONFIG.url).hostname,
      path: new URL(BETTER_STACK_CONFIG.url).pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BETTER_STACK_CONFIG.token}`,
        'Content-Length': Buffer.byteLength(data),
      },
      rejectUnauthorized: true,
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        callback();
      });
    });

    req.on('error', (error) => {
      console.error('Better Stack logging error:', error.message);
      callback(); // Don't fail the logging system
    });

    req.write(data);
    req.end();
  }
}

// Initialize Better Stack transport
let betterStackTransport: BetterStackTransport | null = null;

if (
  BETTER_STACK_CONFIG.token &&
  BETTER_STACK_CONFIG.url &&
  process.env.NODE_ENV !== 'development'
) {
  try {
    betterStackTransport = new BetterStackTransport();
    console.log('Better Stack transport initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Better Stack transport:', error);
    betterStackTransport = null;
  }
} else {
  console.log('Better Stack configuration not provided, using console logging only');
}

// Custom format to add trace context to logs
const addTraceContext = format((info) => {
  const span = api.trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    info.trace_id = spanContext.traceId;
    info.span_id = spanContext.spanId;
    info.trace_flags = spanContext.traceFlags;
  }
  return info;
});

// Custom transport for OpenTelemetry
class OpenTelemetryTransport extends Transport {
  constructor() {
    super();
  }

  log(info: Record<string, unknown>, callback: () => void) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logsApi = (api as any).logs;
    if (logsApi) {
      const logger = logsApi.getLogger('winston-logger');

      const { message, level, timestamp, trace_id, span_id, trace_flags, ...meta } = info;

      const levelStr = level as string;

      // Map Winston levels to OpenTelemetry SeverityNumbers
      let severityNumber = 0; // UNSPECIFIED
      switch (levelStr) {
        case 'error':
          severityNumber = 17;
          break; // ERROR
        case 'warn':
          severityNumber = 13;
          break; // WARN
        case 'info':
          severityNumber = 9;
          break; // INFO
        case 'debug':
          severityNumber = 5;
          break; // DEBUG
        case 'verbose':
          severityNumber = 1;
          break; // TRACE
      }

      logger.emit({
        body: message as string,
        severityNumber,
        severityText: levelStr.toUpperCase(),
        attributes: meta as api.Attributes,
        timestamp: timestamp ? new Date(timestamp as string) : new Date(),
      });
    }
    callback();
  }
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    addTraceContext(), // Add trace context to correlate logs with traces
    format.json(),
  ),
  defaultMeta: {
    service: process.env.OTEL_SERVICE_NAME || 'fairarena-backend',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf((info) => {
          const { timestamp, level, message, trace_id, span_id, ...meta } = info;
          const traceInfo = trace_id
            ? ` [trace:${(trace_id as string).slice(0, 8)}${span_id ? `-${(span_id as string).slice(0, 8)}` : ''}]`
            : '';
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          const logLine = `${timestamp} ${level}: ${message}${traceInfo}${metaStr}`;
          // Make debug logs fully yellow for visibility
          return info.level === 'debug' ? `\x1b[33m${logLine}\x1b[0m` : logLine;
        }),
      ),
    }),

    // Add OpenTelemetry transport
    new OpenTelemetryTransport(),

    // Conditionally add Better Stack transport if available
    ...(betterStackTransport ? [betterStackTransport] : []),
  ],
  // Handle transport errors gracefully
  handleExceptions: true,
  handleRejections: true,
  exceptionHandlers: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf((info) => `EXCEPTION: ${info.message}`),
      ),
    }),
  ],
  rejectionHandlers: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf((info) => `REJECTION: ${info.message}`),
      ),
    }),
  ],
});

// Add transport error handler
logger.on('error', (error) => {
  console.error('Winston logger error:', error);
  // If it's a logging service error, disable the transport
  if (
    error.message &&
    (error.message.includes('Unauthorized') || error.message.includes('ECONNREFUSED'))
  ) {
    disableBetterStackTransport();
  }
});

// Export methods for structured logging with error handling
export const logWithTrace = (level: string, message: string, meta?: Record<string, unknown>) => {
  try {
    const span = api.trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      logger.log(level, message, {
        ...meta,
        trace_id: spanContext.traceId,
        span_id: spanContext.spanId,
      });
    } else {
      logger.log(level, message, meta);
    }
  } catch (error) {
    // Fallback to console if logging fails
    console.error('Logger error, falling back to console:', error);
    console.log(`${level.toUpperCase()}: ${message}`, meta);
  }
};

// Safe logger wrapper that never throws
const safeLogger = {
  error: (message: string, meta?: Record<string, unknown>) => {
    try {
      logger.error(message, meta);
    } catch (error) {
      console.error('Logger error:', error);
      console.error(message, meta);
    }
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    try {
      logger.warn(message, meta);
    } catch (error) {
      console.warn('Logger error:', error);
      console.warn(message, meta);
    }
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    try {
      logger.info(message, meta);
    } catch (error) {
      console.log('Logger error:', error);
      console.info(message, meta);
    }
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    try {
      const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
      logger.log(level, message, meta);
    } catch (error) {
      console.log('Logger error:', error);
      console.debug(message, meta);
    }
  },
  verbose: (message: string, meta?: Record<string, unknown>) => {
    try {
      const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
      logger.log(level, message, meta);
    } catch (error) {
      console.log('Logger error:', error);
      console.log(message, meta);
    }
  },
};

// Function to disable Better Stack transport if it fails
const disableBetterStackTransport = () => {
  if (betterStackTransport && logger.transports.includes(betterStackTransport)) {
    console.error('Disabling Better Stack transport due to failures');
    logger.remove(betterStackTransport);
    betterStackTransport = null;
  }
};

// Global error handlers to prevent crashes from logging issues
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // If it's a logging service error, disable the transport
  if (
    error.message &&
    (error.message.includes('Unauthorized') || error.message.includes('ECONNREFUSED'))
  ) {
    disableBetterStackTransport();
  }
  // Don't exit the process, just log and continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // If it's a logging service error, disable the transport
  if (
    reason &&
    typeof reason === 'object' &&
    'message' in reason &&
    (String(reason.message).includes('Unauthorized') ||
      String(reason.message).includes('ECONNREFUSED'))
  ) {
    disableBetterStackTransport();
  }
  // Don't exit the process, just log and continue
});

export default safeLogger;
