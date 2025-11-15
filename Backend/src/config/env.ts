import * as dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'CLERK_WEBHOOK_SECRET',
  'DATABASE_URL',
  'INNGEST_SIGNING_KEY',
  'INNGEST_EVENT_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const ENV = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET!,
  ARCJET_KEY: process.env.ARCJET_KEY,
  DATABASE_URL: process.env.DATABASE_URL!,
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY!,
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY!,
};
