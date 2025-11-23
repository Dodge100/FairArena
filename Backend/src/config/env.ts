import * as dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
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
  DATABASE_URL_READ_ONLY_1: process.env.DATABASE_URL_READ_ONLY_1!,
  DATABASE_URL_READ_ONLY_2: process.env.DATABASE_URL_READ_ONLY_2!,
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY!,
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY!,
  RESEND_API_KEY: process.env.RESEND_API_KEY!,
  FROM_EMAIL_ADDRESS: process.env.FROM_EMAIL_ADDRESS!,
  JWT_SECRET: process.env.JWT_SECRET!,
  BASE_URL: process.env.BASE_URL || '',
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL!,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN!,
  GOOGLE_SHEETS_PRIVATE_KEY: process.env.GOOGLE_SHEETS_PRIVATE_KEY,
  GOOGLE_SHEETS_CLIENT_EMAIL: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  GOOGLE_SHEETS_NEWSLETTER_ID: process.env.GOOGLE_SHEETS_NEWSLETTER_ID,
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587'),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER!,
  SMTP_PASS: process.env.SMTP_PASS!,
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'resend', // 'resend' or 'nodemailer'
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};
