import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { ENV } from '../../config/env.js';
import logger from '../../utils/logger.js';
import { accountDeletionWarningEmailTemplate } from '../templates/accountDeletionWarning.js';
import { accountPermanentDeletionEmailTemplate } from '../templates/accountPermanentDeletion.js';
import { accountRecoveryEmailTemplate } from '../templates/accountRecovery.js';
import { otpEmailTemplate } from '../templates/otp.js';
import { platformInviteEmailTemplate } from '../templates/platformInvite.js';
import { welcomeEmailTemplate } from '../templates/welcome.js';

const resend = new Resend(ENV.RESEND_API_KEY);

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  host: ENV.SMTP_HOST,
  port: ENV.SMTP_PORT,
  secure: ENV.SMTP_SECURE, // true for 465, false for other ports
  auth: {
    user: ENV.SMTP_USER,
    pass: ENV.SMTP_PASS,
  },
});

// Define parameter types for each template
type WelcomeEmailParams = { userName: string };
type OtpEmailParams = { otp: string };
type PlatformInviteEmailParams = { inviterName: string };
type AccountDeletionWarningEmailParams = { recoveryInstructions: string; deadline: string };
type AccountRecoveryEmailParams = { userName?: string };
type AccountPermanentDeletionEmailParams = {};

// Collect all templates with correct types
export const emailTemplates = {
  welcome: welcomeEmailTemplate as (params: WelcomeEmailParams) => string,
  otp: otpEmailTemplate as (params: OtpEmailParams) => string,
  platformInvite: platformInviteEmailTemplate as (params: PlatformInviteEmailParams) => string,
  'account-deletion-warning': accountDeletionWarningEmailTemplate as (
    params: AccountDeletionWarningEmailParams,
  ) => string,
  'account-recovery': accountRecoveryEmailTemplate as (
    params: AccountRecoveryEmailParams,
  ) => string,
  'account-permanent-deletion': accountPermanentDeletionEmailTemplate as (
    params: AccountPermanentDeletionEmailParams,
  ) => string,
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
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'platformInvite',
  params: PlatformInviteEmailParams,
  headers?: Record<string, string>,
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'account-deletion-warning',
  params: AccountDeletionWarningEmailParams,
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'account-recovery',
  params: AccountRecoveryEmailParams,
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'account-permanent-deletion',
  params: AccountPermanentDeletionEmailParams,
): Promise<unknown>;
export async function sendEmail(
  to: string,
  subject: string,
  templateName:
    | 'welcome'
    | 'otp'
    | 'platformInvite'
    | 'account-deletion-warning'
    | 'account-recovery'
    | 'account-permanent-deletion',
  params:
    | WelcomeEmailParams
    | OtpEmailParams
    | PlatformInviteEmailParams
    | AccountDeletionWarningEmailParams
    | AccountRecoveryEmailParams
    | AccountPermanentDeletionEmailParams,
  headers?: Record<string, string>,
): Promise<unknown> {
  let html: string;
  if (templateName === 'welcome') {
    html = emailTemplates.welcome(params as WelcomeEmailParams);
  } else if (templateName === 'otp') {
    html = emailTemplates.otp(params as OtpEmailParams);
  } else if (templateName === 'platformInvite') {
    html = emailTemplates.platformInvite(params as PlatformInviteEmailParams);
  } else if (templateName === 'account-deletion-warning') {
    html = emailTemplates['account-deletion-warning'](params as AccountDeletionWarningEmailParams);
  } else if (templateName === 'account-recovery') {
    html = emailTemplates['account-recovery'](params as AccountRecoveryEmailParams);
  } else if (templateName === 'account-permanent-deletion') {
    html = emailTemplates['account-permanent-deletion'](
      params as AccountPermanentDeletionEmailParams,
    );
  } else {
    throw new Error(`Unknown template name: ${templateName}`);
  }

  try {
    if (ENV.EMAIL_PROVIDER === 'nodemailer') {
      const mailOptions = {
        from: ENV.FROM_EMAIL_ADDRESS,
        to,
        subject,
        html,
        headers,
      };

      const info = await transporter.sendMail(mailOptions);

      logger.info('Email sent successfully via Nodemailer', { messageId: info.messageId });

      return info;
    } else {
      // Default to Resend
      const emailData: {
        from: string;
        to: string[];
        subject: string;
        html: string;
        headers?: Record<string, string>;
      } = {
        from: ENV.FROM_EMAIL_ADDRESS,
        to: [to],
        subject,
        html,
      };
      if (headers) {
        emailData.headers = headers;
      }
      const { data, error } = await resend.emails.send(emailData);

      if (error) {
        logger.error('Error sending email via Resend:', error);
        throw error;
      }

      logger.info('Email sent successfully via Resend', { data });

      return data;
    }
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

export const sendPlatformInviteEmail = async (
  to: string,
  inviterName: string,
): Promise<unknown> => {
  const unsubscribeUrl = `${ENV.FRONTEND_URL}/api/email/unsubscribe/${encodeURIComponent(to)}`;
  return sendEmail(
    to,
    "You're invited to join FairArena!",
    'platformInvite',
    { inviterName },
    {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
    },
  );
};

export const sendAccountDeletionWarningEmail = async (
  to: string,
  recoveryInstructions: string,
  deadline: string,
): Promise<unknown> => {
  return sendEmail(to, 'Your Account Has Been Deleted', 'account-deletion-warning', {
    recoveryInstructions,
    deadline,
  });
};

export const sendAccountRecoveryEmail = async (to: string, userName?: string): Promise<unknown> => {
  return sendEmail(to, 'Your Account Has Been Recovered', 'account-recovery', { userName });
};

export const sendAccountPermanentDeletionEmail = async (to: string): Promise<unknown> => {
  return sendEmail(
    to,
    'Your Account Has Been Permanently Deleted',
    'account-permanent-deletion',
    {},
  );
};
