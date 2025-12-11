import { Request, Response } from 'express';
import { z } from 'zod';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';

// Zod schema for webhook payload validation
const clerkWebhookSchema = z.object({
  type: z.enum(['user.created', 'user.updated', 'user.deleted']),
  data: z.object({
    id: z.string(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    profile_image_url: z.string().nullish(),
    username: z.string().nullish(),
    email_addresses: z
      .array(
        z.object({
          email_address: z.string().email(),
        }),
      )
      .optional(),
    external_accounts: z
      .array(
        z.object({
          picture: z.string(),
        }),
      )
      .optional(),
  }),
});

export const handleClerkWebhook = async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // Validate the payload
    const validationResult = clerkWebhookSchema.safeParse(payload);
    if (!validationResult.success) {
      logger.warn('Invalid webhook payload', { errors: validationResult.error.issues });
      return res.status(400).json({ error: 'Invalid payload structure' });
    }

    const { type, data } = validationResult.data;

    logger.info('Processing webhook', { type, userId: data.id });

    switch (type) {
      case 'user.created':
        await inngest.send({
          name: 'user.created',
          data: {
            userId: data.id,
            email: data.email_addresses?.[0]?.email_address,
            firstName: data.first_name,
            lastName: data.last_name,
            profileImageUrl: data.external_accounts?.[0]?.picture,
            username: data.username,
          },
        });
        break;
      case 'user.updated':
        await inngest.send({
          name: 'user.updated',
          data: {
            userId: data.id,
            email: data.email_addresses?.[0]?.email_address,
            firstName: data.first_name,
            lastName: data.last_name,
            profileImageUrl: data.external_accounts?.[0]?.picture,
            username: data.username,
          },
        });
        break;
      case 'user.deleted':
        await inngest.send({
          name: 'user.deleted',
          data: {
            userId: data.id,
          },
        });
        break;
      default:
        logger.info(`Unhandled webhook type: ${type}`);
        return res.status(200).json({ message: 'Webhook type not processed' });
    }

    logger.info('Webhook processed successfully', { type, userId: data.id });
    res.status(200).json({ message: 'Webhook processed' });
  } catch (error) {
    logger.error('Webhook processing error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};
