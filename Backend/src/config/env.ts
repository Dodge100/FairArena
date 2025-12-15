import { getReadOnlyPrisma } from '../config/read-only.database.js';
import logger from '../utils/logger.js';
import { redis } from './redis.js';

async function loadEnvs(): Promise<Record<string, string>> {
  const cacheKey = 'env:cache';
  const readOnlyPrisma = getReadOnlyPrisma();
  let envs: Record<string, string> = {};

  let cached: string | null = null;
  try {
    cached = await redis.get(cacheKey);
    logger.info(`Redis get result - cached: ${cached ? 'found' : 'null'}`);
  } catch (error) {
    logger.warn('Failed to retrieve from Redis cache', { error });
  }

  if (cached && typeof cached === 'string') {
    try {
      envs = JSON.parse(cached);
      logger.info('Loaded envs from Redis cache');
    } catch (error) {
      logger.warn('Failed to parse cached envs, falling back to DB', {
        error: (error as Error).message || String(error),
      });
      cached = null; // Force load from DB
    }
  } else if (cached && typeof cached === 'object') {
    envs = cached as Record<string, string>;
    logger.info('Loaded envs from Redis cache (object)');
  } else if (cached) {
    logger.warn('Cached envs is not a string or object, falling back to DB', {
      type: typeof cached,
      value: cached,
    });
    cached = null;
  }

  if (!cached) {
    try {
      const dbEnvs = await readOnlyPrisma.environmentVariable.findMany();
      envs = Object.fromEntries(dbEnvs.map((e) => [e.key, e.value]));
      await redis.setex(cacheKey, 86400, JSON.stringify(envs)); // Cache for 1 day
      logger.info('Loaded envs from DB and cached in Redis');
    } catch (error) {
      logger.warn('Failed to load envs from DB/Redis, using process.env only', { error });
    }
  }

  return envs;
}

const dbEnvs = await loadEnvs();

const requiredEnvVars = [
  'CLERK_WEBHOOK_SECRET',
  'DATABASE_URL',
  'INNGEST_SIGNING_KEY',
  'INNGEST_EVENT_KEY',
  'RESEND_API_KEY',
  'FROM_EMAIL_ADDRESS',
  'JWT_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'DATABASE_URL_READ_ONLY_1',
  'DATABASE_URL_READ_ONLY_2',
  'GOOGLE_GEMINI_API_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'CRON_SECRET',
];

function getEnv(key: string, fallback?: string): string {
  return dbEnvs[key] || process.env[key] || fallback || '';
}

for (const envVar of requiredEnvVars) {
  if (!getEnv(envVar) || getEnv(envVar).length === 0) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const ENV = {
  PORT: parseInt(getEnv('PORT', '3000')),
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  MAINTENANCE_MODE: getEnv('MAINTENANCE_MODE') === 'true',
  CLERK_PUBLISHABLE_KEY: getEnv('CLERK_PUBLISHABLE_KEY'),
  CLERK_SECRET_KEY: getEnv('CLERK_SECRET_KEY'),
  CLERK_WEBHOOK_SECRET: getEnv('CLERK_WEBHOOK_SECRET'),
  ARCJET_KEY: getEnv('ARCJET_KEY'),
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_READ_ONLY_1: process.env.DATABASE_URL_READ_ONLY_1,
  DATABASE_URL_READ_ONLY_2: process.env.DATABASE_URL_READ_ONLY_2,
  INNGEST_SIGNING_KEY: getEnv('INNGEST_SIGNING_KEY'),
  INNGEST_EVENT_KEY: getEnv('INNGEST_EVENT_KEY'),
  RESEND_API_KEY: getEnv('RESEND_API_KEY'),
  FROM_EMAIL_ADDRESS: getEnv('FROM_EMAIL_ADDRESS'),
  JWT_SECRET: getEnv('JWT_SECRET'),
  BASE_URL: getEnv('BASE_URL', ''),
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  GOOGLE_SHEETS_PRIVATE_KEY: getEnv('GOOGLE_SHEETS_PRIVATE_KEY'),
  GOOGLE_RECAPTCHA_SITE_KEY: getEnv('GOOGLE_RECAPTCHA_SITE_KEY', ''),
  GOOGLE_RECAPTCHA_SECRET: getEnv('GOOGLE_RECAPTCHA_SECRET', ''),
  GOOGLE_SHEETS_CLIENT_EMAIL: getEnv('GOOGLE_SHEETS_CLIENT_EMAIL'),
  GOOGLE_SHEETS_NEWSLETTER_ID: getEnv('GOOGLE_SHEETS_NEWSLETTER_ID'),
  SMTP_HOST: getEnv('SMTP_HOST', 'smtp.gmail.com'),
  SMTP_PORT: parseInt(getEnv('SMTP_PORT', '587')),
  SMTP_SECURE: getEnv('SMTP_SECURE') === 'true',
  SMTP_USER: getEnv('SMTP_USER'),
  SMTP_PASS: getEnv('SMTP_PASS'),
  EMAIL_PROVIDER: getEnv('NODE_ENV') === 'production' ? getEnv('EMAIL_PROVIDER') : 'nodemailer',
  FRONTEND_URL: getEnv('FRONTEND_URL', 'http://localhost:5173'),
  GOOGLE_GEMINI_API_KEY: getEnv('GOOGLE_GEMINI_API_KEY'),
  LANGCHAIN_API_KEY: getEnv('LANGCHAIN_API_KEY', ''),
  LANGCHAIN_PROJECT: getEnv('LANGCHAIN_PROJECT', 'fairarena-ai'),
  LANGCHAIN_TRACING_V2: getEnv('LANGCHAIN_TRACING_V2') === 'true',
  RAZORPAY_KEY_ID: getEnv('RAZORPAY_KEY_ID'),
  RAZORPAY_KEY_SECRET: getEnv('RAZORPAY_KEY_SECRET'),
  RAZORPAY_WEBHOOK_SECRET: getEnv('RAZORPAY_WEBHOOK_SECRET', ''),
  PAYMENTS_ENABLED: getEnv('PAYMENTS_ENABLED') === 'true' || false,
  CRON_SECRET: getEnv('CRON_SECRET'),
  FRONTEND_URLS: getEnv('FRONTEND_URLS', ''),
};
