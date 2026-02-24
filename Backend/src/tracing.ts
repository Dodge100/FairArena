/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import * as opentelemetry from '@opentelemetry/sdk-node';
import { LangChainInstrumentation } from '@arizeai/openinference-instrumentation-langchain';
import process from 'process';

// Get configuration from environment
const serviceName = process.env.OTEL_SERVICE_NAME || 'fairarena-backend';
const environment = process.env.NODE_ENV || 'development';
const signozEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const signozKey = process.env.SIGNOZ_INGESTION_KEY;

// Validate endpoint
if (!signozEndpoint || signozEndpoint.includes('<region>')) {
  console.warn(
    '⚠️  OTEL_EXPORTER_OTLP_ENDPOINT is not properly configured. Using default: http://localhost:4318',
  );
}

// Configure headers for SigNoz Cloud
const headers = signozKey ? { 'signoz-ingestion-key': signozKey } : undefined;

// Configure trace exporter
const traceExporter = new OTLPTraceExporter({
  url: `${signozEndpoint.replace(/\/v1\/traces$/, '')}/v1/traces`,
  headers,
});

// Configure log exporter
const logExporter = new OTLPLogExporter({
  url: `${signozEndpoint.replace(/\/v1\/traces$/, '')}/v1/logs`,
  headers,
});

// Configure metrics exporter for Gemini/LLM metrics
const metricExporter = new OTLPMetricExporter({
  url: `${signozEndpoint.replace(/\/v1\/traces$/, '')}/v1/metrics`,
  headers,
});

// Create LangChain instrumentation for Google Gemini tracing
const langchainInstrumentation = new LangChainInstrumentation();

// Initialize the OpenTelemetry SDK
const sdk = new opentelemetry.NodeSDK({
  serviceName,
  traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000, // Export metrics every 60 seconds
  }),
  logRecordProcessor: new BatchLogRecordProcessor(logExporter, {
    maxQueueSize: 1000,
    maxExportBatchSize: 512,
    scheduledDelayMillis: 5000,
  }),
  instrumentations: [
    // Auto-instrument common libraries
    getNodeAutoInstrumentations({
      // Disable instrumentations you don't need
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // File system instrumentation can be noisy
      },
    }),
    // Add Winston instrumentation for log correlation
    new WinstonInstrumentation({
      // This will automatically inject trace context into Winston logs
      logHook: (span, record) => {
        record['trace_id'] = span.spanContext().traceId;
        record['span_id'] = span.spanContext().spanId;
        record['trace_flags'] = span.spanContext().traceFlags;
      },
    }),
    // Add LangChain instrumentation for Google Gemini tracing
    langchainInstrumentation,
  ],
});

// Initialize the SDK and register with the OpenTelemetry API
try {
  sdk.start();
  console.log('✅ OpenTelemetry SDK initialized successfully');
  console.log(`📊 Service: ${serviceName}`);
  console.log(`🌍 Environment: ${environment}`);
  console.log(`🔗 Endpoint: ${signozEndpoint}`);
  console.log(`🔑 Auth: ${signozKey ? '✓ Configured' : '✗ Not set (using local collector)'}`);
} catch (error) {
  console.error('❌ Failed to initialize OpenTelemetry SDK:', error);
}

// Gracefully shut down the SDK on process exit
const shutdown = async () => {
  try {
    await sdk.shutdown();
    console.log('✅ OpenTelemetry SDK shut down successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error shutting down OpenTelemetry SDK:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { sdk };
export default sdk;
