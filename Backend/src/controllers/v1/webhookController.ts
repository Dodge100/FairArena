import crypto from 'crypto';
import { Request, Response } from 'express';
import path from 'path';
import { z } from 'zod';
import { ENV } from '../../config/env.js';
import logger from '../../utils/logger.js';

// Function to verify GitHub webhook signature
function verifyGitHubSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const computedSignature = `sha256=${hmac.digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature));
}

// Zod schema for GitHub push webhook payload validation
const githubPushWebhookSchema = z.object({
  ref: z.string(),
  repository: z.object({
    name: z.string(),
    full_name: z.string(),
  }),
  commits: z.array(
    z.object({
      id: z.string(),
      message: z.string(),
      author: z.object({
        name: z.string(),
        email: z.string(),
      }),
    }),
  ),
  head_commit: z
    .object({
      id: z.string(),
      message: z.string(),
    })
    .optional(),
});

export const handleGitHubWebhook = async (req: Request, res: Response) => {
  try {
    const event = (req as any).githubEvent as string;
    const payload = req.body;
    const signature = req.headers['x-hub-signature-256'] as string;
    const rawBody = (req as any).rawBody;

    // Verify GitHub signature (double verification for security)
    if (!signature || !verifyGitHubSignature(rawBody, signature, ENV.GITHUB_WEBHOOK_SECRET)) {
      logger.warn('Invalid GitHub webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    logger.info('Received GitHub webhook', { event, repository: payload.repository?.full_name });

    // Only handle push events
    if (event !== 'push') {
      logger.info('Ignoring non-push event', { event });
      return res.status(200).json({ message: 'Event ignored' });
    }

    // Validate the payload
    const validationResult = githubPushWebhookSchema.safeParse(payload);
    if (!validationResult.success) {
      logger.warn('Invalid GitHub webhook payload', { errors: validationResult.error.issues });
      return res.status(400).json({ error: 'Invalid payload structure' });
    }

    const { ref, repository, commits } = validationResult.data;

    // Only deploy on pushes to main branch
    if (ref !== 'refs/heads/main') {
      logger.info('Ignoring push to non-main branch', { ref });
      return res.status(200).json({ message: 'Push to non-main branch ignored' });
    }

    if (repository == null || repository.full_name !== 'FairArena/FairArena') {
      logger.warn('Repository information missing or invalid in payload', {
        full_name: repository?.full_name,
      });
      return res.status(400).json({ error: 'Repository information missing or invalid' });
    }

    logger.info('Processing deployment for main branch push', {
      repository: repository.full_name,
      commits: commits.length,
      ref,
    });

    // Execute deployment script asynchronously (fire-and-forget)
    const { spawn } = await import('child_process');

    const deployCwd = path.join(process.cwd(), '..');
    logger.info('Triggering deployment script', { script: './deploy.sh', cwd: deployCwd });

    // Run deploy.sh with sudo privileges in background using spawn
    const child = spawn('sudo', ['./deploy.sh'], {
      cwd: deployCwd,
      env: { ...process.env, NODE_ENV: 'production' },
      detached: true, // Run independently
      stdio: 'ignore', // Don't inherit stdio
    });

    // Log deployment process events asynchronously
    child.on('exit', (code, signal) => {
      logger.info('Deployment process exited', { code, signal, repository: repository.full_name });
    });

    child.on('error', (error) => {
      logger.error('Failed to start deployment process', {
        error: error.message,
        repository: repository.full_name,
      });
    });

    // Unref to allow the parent process to exit independently
    child.unref();

    // Respond immediately to webhook
    res.status(200).json({
      message: 'Deployment triggered successfully',
      repository: repository.full_name,
      commits: commits.length,
    });
  } catch (error) {
    logger.error('GitHub webhook processing error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};
