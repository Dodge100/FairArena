import { Request, Response } from 'express';
import { inngest } from '../../inngest/v1/client.js';

export const handleClerkWebhook = async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;

    if (type === 'user.created') {
      // Fire and forget - Inngest handles retries
      inngest
        .send({
          name: 'user.created',
          data: {
            userId: data.id,
            email: data.email_addresses?.[0]?.email_address,
          },
        })
        .catch((error) => console.error('Failed to send user.created event:', error));
    } else if (type === 'user.updated') {
      // Fire and forget - Inngest handles retries
      inngest
        .send({
          name: 'user.updated',
          data: {
            userId: data.id,
            email: data.email_addresses?.[0]?.email_address,
          },
        })
        .catch((error) => console.error('Failed to send user.updated event:', error));
    } else if (type === 'user.deleted') {
      inngest
        .send({
          name: 'user.deleted',
          data: {
            userId: data.id,
          },
        })
        .catch((error) => console.error('Failed to send user.deleted event:', error));
    } else {
      console.log(`Unhandled webhook type: ${type}`);
      return res.status(200).json({ message: 'Webhook type not processed' });
    }

    res.status(200).json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
