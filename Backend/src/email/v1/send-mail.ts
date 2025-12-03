import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { ENV } from '../../config/env.js';
import logger from '../../utils/logger.js';
import { accountDeletionWarningEmailTemplate } from '../templates/accountDeletionWarning.js';
import { accountPermanentDeletionEmailTemplate } from '../templates/accountPermanentDeletion.js';
import { accountRecoveryEmailTemplate } from '../templates/accountRecovery.js';
import { dataExportEmailTemplate } from '../templates/dataExport.js';
import { dataExportErrorEmailTemplate } from '../templates/dataExportError.js';
import { otpEmailTemplate } from '../templates/otp.js';
import { paymentFailedEmailTemplate } from '../templates/paymentFailed.js';
import { paymentSuccessEmailTemplate } from '../templates/paymentSuccess.js';
import { platformInviteEmailTemplate } from '../templates/platformInvite.js';
import { refundCompletedEmailTemplate } from '../templates/refundCompleted.js';
import { refundFailedEmailTemplate } from '../templates/refundFailed.js';
import { refundInitiatedEmailTemplate } from '../templates/refundInitiated.js';
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
type DataExportEmailParams = {
  userName: string;
  exportDate: string;
  dataSize: string;
};
type DataExportErrorEmailParams = { userName: string; errorMessage: string };
type PaymentSuccessEmailParams = {
  userName: string;
  planName: string;
  amount: number;
  currency: string;
  credits: number;
  orderId: string;
  paymentId: string;
  paymentMethod: string;
  transactionDate: string;
  invoiceUrl?: string;
};
type PaymentFailedEmailParams = {
  userName: string;
  planName: string;
  amount: number;
  currency: string;
  orderId: string;
  paymentId?: string;
  failureReason: string;
  transactionDate: string;
};
type RefundInitiatedEmailParams = {
  userName: string;
  planName: string;
  refundAmount: number;
  originalAmount: number;
  currency: string;
  credits: number;
  orderId: string;
  paymentId: string;
  refundId: string;
  refundDate: string;
  estimatedDays: string;
};
type RefundCompletedEmailParams = {
  userName: string;
  planName: string;
  refundAmount: number;
  currency: string;
  orderId: string;
  paymentId: string;
  refundId: string;
  completedDate: string;
  paymentMethod: string;
};
type RefundFailedEmailParams = {
  userName: string;
  planName: string;
  refundAmount: number;
  currency: string;
  orderId: string;
  paymentId: string;
  refundId: string;
  failureReason: string;
  failureDate: string;
};

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
  'data-export': dataExportEmailTemplate as (params: DataExportEmailParams) => string,
  'data-export-error': dataExportErrorEmailTemplate as (
    params: DataExportErrorEmailParams,
  ) => string,
  'payment-success': paymentSuccessEmailTemplate as (params: PaymentSuccessEmailParams) => string,
  'payment-failed': paymentFailedEmailTemplate as (params: PaymentFailedEmailParams) => string,
  'refund-initiated': refundInitiatedEmailTemplate as (
    params: RefundInitiatedEmailParams,
  ) => string,
  'refund-completed': refundCompletedEmailTemplate as (
    params: RefundCompletedEmailParams,
  ) => string,
  'refund-failed': refundFailedEmailTemplate as (params: RefundFailedEmailParams) => string,
};

// Function overloads for sendEmail
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'welcome',
  params: WelcomeEmailParams,
  headers?: Record<string, string>,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[],
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'otp',
  params: OtpEmailParams,
  headers?: Record<string, string>,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[],
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'platformInvite',
  params: PlatformInviteEmailParams,
  headers?: Record<string, string>,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[],
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'account-deletion-warning',
  params: AccountDeletionWarningEmailParams,
  headers?: Record<string, string>,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[],
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'account-recovery',
  params: AccountRecoveryEmailParams,
  headers?: Record<string, string>,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[],
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'account-permanent-deletion',
  params: AccountPermanentDeletionEmailParams,
  headers?: Record<string, string>,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[],
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'data-export',
  params: DataExportEmailParams,
  headers?: Record<string, string>,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[],
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'data-export-error',
  params: DataExportErrorEmailParams,
  headers?: Record<string, string>,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[],
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'payment-success',
  params: PaymentSuccessEmailParams,
  headers?: Record<string, string>,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[],
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'payment-failed',
  params: PaymentFailedEmailParams,
  headers?: Record<string, string>,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[],
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'refund-initiated',
  params: RefundInitiatedEmailParams,
  headers?: Record<string, string>,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[],
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'refund-completed',
  params: RefundCompletedEmailParams,
  headers?: Record<string, string>,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[],
): Promise<unknown>;
export function sendEmail(
  to: string,
  subject: string,
  templateName: 'refund-failed',
  params: RefundFailedEmailParams,
  headers?: Record<string, string>,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[],
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
    | 'account-permanent-deletion'
    | 'data-export'
    | 'data-export-error'
    | 'payment-success'
    | 'payment-order-created'
    | 'payment-failed'
    | 'refund-initiated'
    | 'refund-completed'
    | 'refund-failed',
  params:
    | WelcomeEmailParams
    | OtpEmailParams
    | PlatformInviteEmailParams
    | AccountDeletionWarningEmailParams
    | AccountRecoveryEmailParams
    | AccountPermanentDeletionEmailParams
    | DataExportEmailParams
    | DataExportErrorEmailParams
    | PaymentSuccessEmailParams
    | PaymentFailedEmailParams
    | RefundInitiatedEmailParams
    | RefundCompletedEmailParams
    | RefundFailedEmailParams,
  headers?: Record<string, string>,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[],
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
  } else if (templateName === 'data-export') {
    html = emailTemplates['data-export'](params as DataExportEmailParams);
  } else if (templateName === 'data-export-error') {
    html = emailTemplates['data-export-error'](params as DataExportErrorEmailParams);
  } else if (templateName === 'payment-success') {
    html = emailTemplates['payment-success'](params as PaymentSuccessEmailParams);
  } else if (templateName === 'payment-failed') {
    html = emailTemplates['payment-failed'](params as PaymentFailedEmailParams);
  } else if (templateName === 'refund-initiated') {
    html = emailTemplates['refund-initiated'](params as RefundInitiatedEmailParams);
  } else if (templateName === 'refund-completed') {
    html = emailTemplates['refund-completed'](params as RefundCompletedEmailParams);
  } else if (templateName === 'refund-failed') {
    html = emailTemplates['refund-failed'](params as RefundFailedEmailParams);
  } else {
    throw new Error(`Unknown template name: ${templateName}`);
  }

  try {
    if (ENV.EMAIL_PROVIDER === 'nodemailer') {
      const mailOptions: {
        from: string;
        to: string;
        subject: string;
        html: string;
        headers?: Record<string, string>;
        attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
      } = {
        from: ENV.FROM_EMAIL_ADDRESS,
        to,
        subject,
        html,
        headers,
      };
      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments;
      }

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
        attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
      } = {
        from: ENV.FROM_EMAIL_ADDRESS,
        to: [to],
        subject,
        html,
      };
      if (headers) {
        emailData.headers = headers;
      }
      if (attachments && attachments.length > 0) {
        emailData.attachments = attachments;
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

export const sendDataExportEmail = async (
  to: string,
  userName: string,
  exportDate: string,
  dataSize: string,
  attachments: { filename: string; content: Buffer | string; contentType?: string }[],
): Promise<unknown> => {
  return sendEmail(
    to,
    'Your FairArena Data Export',
    'data-export',
    {
      userName,
      exportDate,
      dataSize,
    },
    undefined,
    attachments,
  );
};

export const sendDataExportErrorEmail = async (
  to: string,
  userName: string,
  errorMessage: string,
): Promise<unknown> => {
  return sendEmail(to, 'Data Export Failed', 'data-export-error', {
    userName,
    errorMessage,
  });
};

export const sendPaymentSuccessEmail = async (
  to: string,
  userName: string,
  planName: string,
  amount: number,
  currency: string,
  credits: number,
  orderId: string,
  paymentId: string,
  paymentMethod: string,
  transactionDate: string,
  invoiceUrl?: string,
): Promise<unknown> => {
  return sendEmail(to, 'Payment Successful - FairArena', 'payment-success', {
    userName,
    planName,
    amount,
    currency,
    credits,
    orderId,
    paymentId,
    paymentMethod,
    transactionDate,
    invoiceUrl,
  });
};

export const sendPaymentFailedEmail = async (
  to: string,
  userName: string,
  planName: string,
  amount: number,
  currency: string,
  orderId: string,
  failureReason: string,
  transactionDate: string,
  paymentId?: string,
): Promise<unknown> => {
  return sendEmail(to, 'Payment Failed - FairArena', 'payment-failed', {
    userName,
    planName,
    amount,
    currency,
    orderId,
    paymentId,
    failureReason,
    transactionDate,
  });
};

export const sendRefundInitiatedEmail = async (
  to: string,
  userName: string,
  planName: string,
  refundAmount: number,
  originalAmount: number,
  currency: string,
  credits: number,
  orderId: string,
  paymentId: string,
  refundId: string,
  refundDate: string,
  estimatedDays: string,
): Promise<unknown> => {
  return sendEmail(to, 'Refund Initiated - FairArena', 'refund-initiated', {
    userName,
    planName,
    refundAmount,
    originalAmount,
    currency,
    credits,
    orderId,
    paymentId,
    refundId,
    refundDate,
    estimatedDays,
  });
};

export const sendRefundCompletedEmail = async (
  to: string,
  userName: string,
  planName: string,
  refundAmount: number,
  currency: string,
  orderId: string,
  paymentId: string,
  refundId: string,
  completedDate: string,
  paymentMethod: string,
): Promise<unknown> => {
  return sendEmail(to, 'Refund Completed - FairArena', 'refund-completed', {
    userName,
    planName,
    refundAmount,
    currency,
    orderId,
    paymentId,
    refundId,
    completedDate,
    paymentMethod,
  });
};

export const sendRefundFailedEmail = async (
  to: string,
  userName: string,
  planName: string,
  refundAmount: number,
  currency: string,
  orderId: string,
  paymentId: string,
  refundId: string,
  failureReason: string,
  failureDate: string,
): Promise<unknown> => {
  return sendEmail(to, 'Refund Failed - FairArena', 'refund-failed', {
    userName,
    planName,
    refundAmount,
    currency,
    orderId,
    paymentId,
    refundId,
    failureReason,
    failureDate,
  });
};
