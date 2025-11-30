import * as api from '@opentelemetry/api';
import { createLogger, format, transports } from 'winston';

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
          const traceInfo = trace_id ? ` [trace:${trace_id.slice(0, 8)}]` : '';
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${message}${traceInfo}${metaStr}`;
        }),
      ),
    }),
    // Add file transport for production
    // ...(process.env.NODE_ENV === 'production'
    //   ? [
    //       new transports.File({ filename: 'logs/error.log', level: 'error' }),
    //       new transports.File({ filename: 'logs/combined.log' }),
    //     ]
    //   : []),
  ],
});

// Export methods for structured logging
export const logWithTrace = (level: string, message: string, meta?: any) => {
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
};

export default logger;
