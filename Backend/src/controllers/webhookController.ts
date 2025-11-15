import { Request, Response } from 'express';
import { inngest } from '../inngest/client.js';

export const handleClerkWebhook = async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;

    if (type === 'user.created') {
      await inngest.send({
        name: 'user.created',
        data: {
          userId: data.id,
          email: data.email_addresses?.[0]?.email_address,
        },
      });
    } else if (type === 'user.updated') {
      await inngest.send({
        name: 'user.updated',
        data: {
          userId: data.id,
          email: data.email_addresses?.[0]?.email_address,
        },
      });
    }

    res.status(200).json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
