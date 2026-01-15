import notificationapi from 'notificationapi-node-server-sdk';
import { ENV } from '../../config/env.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

// Initialize NotificationAPI
try {
  notificationapi.init(
    ENV.NOTIFICATIONAPI_CLIENT_ID || '',
    ENV.NOTIFICATIONAPI_CLIENT_SECRET || ''
  );
  logger.info('NotificationAPI initialized for voice calls');
} catch (error) {
  logger.error('Failed to initialize NotificationAPI', {
    error: error instanceof Error ? error.message : String(error),
  });
}

const sendVoiceCall = async (userId: string, phoneNumber: string, otp: string) => {
  try {
    // Validate phone number format
    if (!phoneNumber || phoneNumber.length < 10) {
      throw new Error('Invalid phone number format');
    }

    // Format phone number for NotificationAPI (ensure it has country code)
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

    logger.info('Sending voice call OTP via NotificationAPI', {
      phoneNumber: formattedPhone.slice(-4),
    });

    // Send voice call via NotificationAPI
    await notificationapi.send({
      type: 'credit_call',
      to: {
        id: userId, // Use userId as identifier
        number: formattedPhone,
      },
      parameters: {
        otp,
        expiryMinutes: '15',
      },
      templateId: 'call_template',
    });

    logger.info('Voice call OTP sent successfully via NotificationAPI', {
      phoneNumber: formattedPhone.slice(-4),
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to send voice call via NotificationAPI', {
      error: error instanceof Error ? error.message : String(error),
      phoneNumber: phoneNumber.toString().slice(-4),
    });
    throw error;
  }
};

export const creditsSendVoiceOtp = inngest.createFunction(
  { id: 'credits/send-voice-otp' },
  { event: 'credits/send-voice-otp' },
  async ({ event }) => {
    const { userId, phoneNumber, otp, ip } = event.data;

    try {
      logger.info('Processing voice call OTP send request', { userId, phoneNumber, ip });
      const voiceResult = await sendVoiceCall(userId, phoneNumber, otp);

      if (voiceResult.success) {
        logger.info('Voice call OTP sent successfully', { userId, phoneNumber: phoneNumber.toString().slice(-4) });

        // Log the action
        await inngest.send({
          name: 'log.create',
          data: {
            userId,
            action: 'voice-otp-sent',
            level: 'INFO',
            metadata: {
              phoneNumber: phoneNumber.toString().slice(-4), // Log only last 4 digits
              ip,
              purpose: 'credits_verification',
              otpType: otp.length === 6 && /^\d+$/.test(otp) ? 'numeric' : 'alphanumeric',
            },
          },
        });

        return { success: true };
      }
    } catch (error) {
      logger.error('Failed to send voice call OTP', {
        userId,
        phoneNumber: phoneNumber.toString().slice(-4),
        error: error instanceof Error ? error.message : String(error),
      });

      // Log the failure
      await inngest.send({
        name: 'log.create',
        data: {
          userId,
          action: 'voice-otp-failed',
          level: 'ERROR',
          metadata: {
            phoneNumber: phoneNumber.toString().slice(-4),
            ip,
            purpose: 'credits_verification',
            error: error instanceof Error ? error.message : String(error),
          },
        },
      });

      throw error;
    }
  },
);
