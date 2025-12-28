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
  logger.info('NotificationAPI initialized for SMS');
} catch (error) {
  logger.error('Failed to initialize NotificationAPI', {
    error: error instanceof Error ? error.message : String(error),
  });
}

const sendSms = async (phoneNumber: number, otp: string) => {
  try {
    // Validate phone number format
    const phoneStr = phoneNumber.toString();
    if (!phoneStr || phoneStr.length < 10) {
      throw new Error('Invalid phone number format');
    }

    // Format phone number for NotificationAPI (ensure it has country code)
    const formattedPhone = phoneStr.startsWith('+') ? phoneStr : `+${phoneStr}`;

    logger.info('Sending SMS OTP via NotificationAPI', {
      phoneNumber: formattedPhone.slice(-4),
    });

    // Send SMS via NotificationAPI
    await notificationapi.send({
      type: 'credits_sms_otp',
      to: {
        id: phoneStr,
        number: formattedPhone,
      },
      parameters: {
        otp,
        expiryMinutes: '15',
      },
      templateId: 'credit_verification',
    });

    logger.info('SMS OTP sent successfully via NotificationAPI', {
      phoneNumber: formattedPhone.slice(-4),
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to send SMS via NotificationAPI', {
      error: error instanceof Error ? error.message : String(error),
      phoneNumber: phoneNumber.toString().slice(-4),
    });
    throw error;
  }
};

export const creditsSendSmsOtp = inngest.createFunction(
  { id: 'credits/send-sms-otp' },
  { event: 'credits/send-sms-otp' },
  async ({ event }) => {
    const { userId, phoneNumber, otp, ip } = event.data;

    try {
      logger.info('Processing SMS OTP send request', { userId, phoneNumber, ip });

      const smsResult = await sendSms(phoneNumber, otp);

      if (smsResult.success) {
        logger.info('SMS OTP sent successfully', { userId, phoneNumber: phoneNumber.toString().slice(-4) });

        // Log the action
        await inngest.send({
          name: 'log.create',
          data: {
            userId,
            action: 'sms-otp-sent',
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
      } else {
        logger.error('Failed to send SMS OTP', { userId, phoneNumber: phoneNumber.toString().slice(-4) });
        return { success: false, error: 'Failed to send SMS' };
      }
    } catch (error) {
      logger.error('Error sending SMS OTP', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        phoneNumber,
      });
      return { success: false, error: 'Internal error' };
    }
  },
);
