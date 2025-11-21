import { Resend } from 'resend';
import { ENV } from '../../config/env.js';
import { welcomeEmailTemplate } from '../templates/welcome.js';
import { otpEmailTemplate } from '../templates/otp.js';
import logger from '../../utils/logger.js';

const resend = new Resend(ENV.RESEND_API_KEY);

// Define parameter types for each template
type WelcomeEmailParams = { userName: string };
type OtpEmailParams = { otp: string };

// Collect all templates with correct types
export const emailTemplates = {
  welcome: welcomeEmailTemplate as (params: WelcomeEmailParams) => string,
  otp: otpEmailTemplate as (params: OtpEmailParams) => string,
};

// Function overloads for sendEmail
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'welcome',
  params: WelcomeEmailParams,
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'otp',
  params: OtpEmailParams,
): Promise<unknown>;
export async function sendEmail(
  to: string,
  subject: string,
  templateName: 'welcome' | 'otp',
  params: WelcomeEmailParams | OtpEmailParams,
): Promise<unknown> {
  let html: string;
  if (templateName === 'welcome') {
    html = emailTemplates.welcome(params as WelcomeEmailParams);
  } else if (templateName === 'otp') {
    html = emailTemplates.otp(params as OtpEmailParams);
  } else {
    throw new Error(`Unknown template name: ${templateName}`);
  }

  try {
    const { data, error } = await resend.emails.send({
      from: ENV.FROM_EMAIL_ADDRESS,
      to: [to],
      subject,
      html,
    });

    if (error) {
      logger.error('Error sending email:', error);
      throw error;
    }

    return data;
  } catch (err) {
    logger.error('Failed to send email:', err);
    throw err;
  }
}

export const sendWelcomeEmail = async (to: string, userName: string): Promise<unknown> => {
  return sendEmail(to, 'Welcome to FairArena', 'welcome', { userName });
};

export const sendOtpEmail = async (to: string, otp: string): Promise<unknown> => {
  return sendEmail(to, 'Account Verification - FairArena', 'otp', { otp });
};
