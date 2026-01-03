import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import logger from '../utils/logger.js';
import { redis } from './redis.js';

const requiredEnvVars = [
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
  'ACCESS_TOKEN_EXPIRY',
  'REFRESH_TOKEN_EXPIRY_DAYS',
  'SESSION_PREFIX',
  'USER_SESSIONS_PREFIX',
  'BCRYPT_ROUNDS',
];

const productionRequiredEnvVars = [...requiredEnvVars];

async function loadEnvs(): Promise<Record<string, string>> {
  const useAzureKeyVault = process.env.NODE_ENV === 'production';

  if (useAzureKeyVault) {
    try {
      return await loadEnvsFromKeyVault();
    } catch (error) {
      logger.warn('Failed to load envs from Azure Key Vault, falling back to DB and Redis', {
        error,
      });
      return await loadEnvsFromDbAndRedis();
    }
  } else {
    return await loadEnvsFromDbAndRedis();
  }
}

async function loadEnvsFromKeyVault(): Promise<Record<string, string>> {
  const keyVaultUrl = process.env.AZURE_KEY_VAULT_URL;
  if (!keyVaultUrl) {
    throw new Error('AZURE_KEY_VAULT_URL is required in production');
  }

  const credential = new DefaultAzureCredential();
  const client = new SecretClient(keyVaultUrl, credential);

  const envs: Record<string, string> = {};

  // List all secrets in the Key Vault
  const secretProperties = client.listPropertiesOfSecrets();
  for await (const secretProperty of secretProperties) {
    const key = secretProperty.name;
    // Convert back from hyphens to underscores for internal use
    const internalKey = key.replace(/-/g, '_');
    try {
      const secret = await client.getSecret(key);
      if (secret.value) {
        envs[internalKey] = secret.value;
        logger.info(`Loaded secret ${internalKey} from Azure Key Vault`);
      }
    } catch (error) {
      logger.error(`Failed to load secret ${internalKey} from Azure Key Vault`, { error });
      // Don't throw, as some secrets might be optional
    }
  }

  return envs;
}

async function loadEnvsFromDbAndRedis(): Promise<Record<string, string>> {
  const { getReadOnlyPrisma } = await import('../config/read-only.database.js');
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

const useAzureKeyVault = process.env.NODE_ENV === 'production';

function getEnv(key: string, fallback?: string): string {
  return dbEnvs[key] || process.env[key] || fallback || '';
}

const envVarsToCheck = useAzureKeyVault ? productionRequiredEnvVars : requiredEnvVars;

for (const envVar of envVarsToCheck) {
  if (!getEnv(envVar) || getEnv(envVar).length === 0) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// AZURE_KEY_VAULT_URL must be set directly in env vars for Key Vault access
if (
  useAzureKeyVault &&
  (!process.env.AZURE_KEY_VAULT_URL || process.env.AZURE_KEY_VAULT_URL.length === 0)
) {
  throw new Error('Missing required environment variable: AZURE_KEY_VAULT_URL');
}

export const ENV = {
  PORT: parseInt(getEnv('PORT', '3000')),
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  CORS_URL: getEnv('CORS_URL', 'localhost:5173'),
  MAINTENANCE_MODE: getEnv('MAINTENANCE_MODE') === 'true',
  // Google OAuth
  GOOGLE_CLIENT_ID: getEnv('GOOGLE_CLIENT_ID', ''),
  GOOGLE_CLIENT_SECRET: getEnv('GOOGLE_CLIENT_SECRET', ''),
  GOOGLE_CALLBACK_URL: getEnv('GOOGLE_CALLBACK_URL'),
  // GitHub OAuth
  GITHUB_CLIENT_ID: getEnv('GITHUB_CLIENT_ID', ''),
  GITHUB_CLIENT_SECRET: getEnv('GITHUB_CLIENT_SECRET', ''),
  GITHUB_CALLBACK_URL: getEnv('GITHUB_CALLBACK_URL'),
  // Microsoft OAuth
  MICROSOFT_CLIENT_ID: getEnv('MICROSOFT_CLIENT_ID', ''),
  MICROSOFT_CLIENT_SECRET: getEnv('MICROSOFT_CLIENT_SECRET', ''),
  MICROSOFT_CALLBACK_URL: getEnv('MICROSOFT_CALLBACK_URL'),
  // Discord OAuth
  DISCORD_CLIENT_ID: getEnv('DISCORD_CLIENT_ID', ''),
  DISCORD_CLIENT_SECRET: getEnv('DISCORD_CLIENT_SECRET', ''),
  DISCORD_CALLBACK_URL: getEnv('DISCORD_CALLBACK_URL'),
  // Hugging Face OAuth
  HUGGINGFACE_CLIENT_ID: getEnv('HUGGINGFACE_CLIENT_ID', ''),
  HUGGINGFACE_CLIENT_SECRET: getEnv('HUGGINGFACE_CLIENT_SECRET', ''),
  HUGGINGFACE_CALLBACK_URL: getEnv('HUGGINGFACE_CALLBACK_URL'),
  // GitLab OAuth
  GITLAB_CLIENT_ID: getEnv('GITLAB_CLIENT_ID', ''),
  GITLAB_CLIENT_SECRET: getEnv('GITLAB_CLIENT_SECRET', ''),
  GITLAB_CALLBACK_URL: getEnv('GITLAB_CALLBACK_URL'),
  // Slack OAuth
  SLACK_CLIENT_ID: getEnv('SLACK_CLIENT_ID', ''),
  SLACK_CLIENT_SECRET: getEnv('SLACK_CLIENT_SECRET', ''),
  SLACK_CALLBACK_URL: getEnv('SLACK_CALLBACK_URL'),
  // Notion OAuth
  NOTION_CLIENT_ID: getEnv('NOTION_CLIENT_ID', ''),
  NOTION_CLIENT_SECRET: getEnv('NOTION_CLIENT_SECRET', ''),
  NOTION_CALLBACK_URL: getEnv('NOTION_CALLBACK_URL'),
  // X (Twitter) OAuth
  X_CLIENT_ID: getEnv('X_CLIENT_ID', ''),
  X_CLIENT_SECRET: getEnv('X_CLIENT_SECRET', ''),
  X_CALLBACK_URL: getEnv('X_CALLBACK_URL'),
  ACCESS_TOKEN_EXPIRY: getEnv('ACCESS_TOKEN_EXPIRY', '15m'),
  REFRESH_TOKEN_EXPIRY_DAYS: parseInt(getEnv('REFRESH_TOKEN_EXPIRY_DAYS', '30')),
  SESSION_PREFIX: getEnv('SESSION_PREFIX', 'session:'),
  USER_SESSIONS_PREFIX: getEnv('USER_SESSIONS_PREFIX', 'user_sessions:'),
  BCRYPT_ROUNDS: parseInt(getEnv('BCRYPT_ROUNDS', '12')),
  ARCJET_KEY: getEnv('ARCJET_KEY'),
  DATABASE_URL: getEnv('DATABASE_URL'),
  DATABASE_URL_READ_ONLY_1: getEnv('DATABASE_URL_READ_ONLY_1'),
  DATABASE_URL_READ_ONLY_2: getEnv('DATABASE_URL_READ_ONLY_2'),
  INNGEST_SIGNING_KEY: getEnv('INNGEST_SIGNING_KEY'),
  INNGEST_EVENT_KEY: getEnv('INNGEST_EVENT_KEY'),
  RESEND_API_KEY: getEnv('RESEND_API_KEY'),
  FROM_EMAIL_ADDRESS: getEnv('FROM_EMAIL_ADDRESS'),
  JWT_SECRET: getEnv('JWT_SECRET'),
  BASE_URL: getEnv('BASE_URL', ''),
  UPSTASH_REDIS_REST_URL: getEnv('UPSTASH_REDIS_REST_URL'),
  UPSTASH_REDIS_REST_TOKEN: getEnv('UPSTASH_REDIS_REST_TOKEN'),
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
  NOTIFICATIONAPI_CLIENT_ID: getEnv('NOTIFICATIONAPI_CLIENT_ID', ''),
  NOTIFICATIONAPI_CLIENT_SECRET: getEnv('NOTIFICATIONAPI_CLIENT_SECRET', ''),
  HEALTHZ_HEADER_NAME: getEnv('HEALTHZ_HEADER_NAME', ''),
  HEALTHZ_HEADER_VALUE: getEnv('HEALTHZ_HEADER_VALUE', ''),
  BETTER_STACK_HEARTBEAT_ID: getEnv('BETTER_STACK_HEARTBEAT_ID', ''),
  GITHUB_WEBHOOK_SECRET: getEnv('GITHUB_WEBHOOK_SECRET', ''),
  INNGEST_BASE_URL: getEnv('INNGEST_BASE_URL', 'http://localhost:8288'),
  CREDENTIAL_VALIDATOR_URL: getEnv('CREDENTIAL_VALIDATOR_URL', ''),
  AZURE_STORAGE_CONNECTION_STRING: getEnv('AZURE_STORAGE_CONNECTION_STRING'),
  AZURE_STORAGE_CONTAINER_NAME: getEnv('AZURE_STORAGE_CONTAINER_NAME'),
  MFA_ENCRYPTION_KEY: getEnv('MFA_ENCRYPTION_KEY', ''),
  NEW_SIGNUP_ENABLED: getEnv('NEW_SIGNUP_ENABLED') === 'true',
};
