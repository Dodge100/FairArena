/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import nodemailer from 'nodemailer';
import { Pingram } from 'pingram';
import { Resend } from 'resend';
import { ENV } from '../../config/env.js';
import logger from '../../utils/logger.js';
import { accountDeletionFailedEmailTemplate } from '../templates/accountDeletionFailed.js';
import { accountDeletionWarningEmailTemplate } from '../templates/accountDeletionWarning.js';
import { accountPermanentDeletionEmailTemplate } from '../templates/accountPermanentDeletion.js';
import { accountRecoveryEmailTemplate } from '../templates/accountRecovery.js';
import { backupCodesRegeneratedTemplate } from '../templates/backupCodesRegenerated.js';
import { backupCodeUsedTemplate } from '../templates/backupCodeUsed.js';
import { couponRedeemedEmailTemplate } from '../templates/couponRedeemed.js';
import { dataExportEmailTemplate } from '../templates/dataExport.js';
import { dataExportErrorEmailTemplate } from '../templates/dataExportError.js';
import { emailVerificationTemplate } from '../templates/emailVerification.js';
import { freeCreditsClaimedEmailTemplate } from '../templates/freeCreditsClaimed.js';
import { loginNotificationTemplate } from '../templates/loginNotification.js';
import { mfaDisabledTemplate } from '../templates/mfaDisabled.js';
import { mfaEnabledTemplate } from '../templates/mfaEnabled.js';
import { mfaOtpTemplate } from '../templates/mfaOtp.js';
import { newDeviceLoginTemplate } from '../templates/newDeviceLogin.js';
import { oauthAppAuthorizedTemplate } from '../templates/oauthAppAuthorized.js';
import { otpEmailTemplate } from '../templates/otp.js';
import { passkeyAddedTemplate } from '../templates/passkeyAdded.js';
import { passkeyRemovedTemplate } from '../templates/passkeyRemoved.js';
import { passwordChangedTemplate } from '../templates/passwordChanged.js';
import { passwordResetTemplate } from '../templates/passwordReset.js';
import { paymentFailedEmailTemplate } from '../templates/paymentFailed.js';
import { paymentSuccessEmailTemplate } from '../templates/paymentSuccess.js';
import { phoneNumberAddedEmailTemplate } from '../templates/phoneNumberAdded.js';
import { platformInviteEmailTemplate } from '../templates/platformInvite.js';
import { refundCompletedEmailTemplate } from '../templates/refundCompleted.js';
import { refundFailedEmailTemplate } from '../templates/refundFailed.js';
import { refundInitiatedEmailTemplate } from '../templates/refundInitiated.js';
import { securityKeyAddedTemplate } from '../templates/securityKeyAdded.js';
import { securityKeyRemovedTemplate } from '../templates/securityKeyRemoved.js';
import { subscriptionActivatedEmailTemplate } from '../templates/subscriptionActivated.js';
import { subscriptionCancelledEmailTemplate } from '../templates/subscriptionCancelled.js';
import { subscriptionPaymentFailedEmailTemplate } from '../templates/subscriptionPaymentFailed.js';
import { subscriptionRenewedEmailTemplate } from '../templates/subscriptionRenewed.js';
import { supportConfirmationEmailTemplate } from '../templates/support-confirmation.js';
import { teamInviteEmailTemplate } from '../templates/teamInvite.js';
import { waitlistConfirmationTemplate } from '../templates/waitlistConfirmation.js';
import { weeklyFeedbackEmailTemplate } from '../templates/weekly-feedback.js';
import { welcomeEmailTemplate } from '../templates/welcome.js';

const resend = new Resend(ENV.RESEND_API_KEY);

const notificationapi = new Pingram({
  apiKey: ENV.PINGRAM_API_KEY,
  baseUrl: 'https://api.pingram.io',
});

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
type OtpEmailParams = {
  otp: string;
  location?: {
    city: string;
    region: string;
    country: string;
    latitude: number;
    longitude: number;
  } | null;
};
type PlatformInviteEmailParams = { inviterName: string };
type AccountDeletionWarningEmailParams = { recoveryInstructions: string; deadline: string };
type AccountDeletionFailedEmailParams = { message: string };
type AccountRecoveryEmailParams = { userName?: string };
type AccountPermanentDeletionEmailParams = {};
type DataExportEmailParams = {
  userName: string;
  exportDate: string;
  dataSize: string;
};
type DataExportErrorEmailParams = { userName: string; errorMessage: string };
type FreeCreditsClaimedEmailParams = { userName: string; creditsAdded: number; newBalance: number };
type PhoneNumberAddedEmailParams = { userName: string; phoneNumber: string };
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
type WeeklyFeedbackEmailParams = { name: string; feedbackUrl: string };
type SubscriptionActivatedEmailParams = {
  firstName: string;
  planName: string;
  tier: string;
  billingCycle: string;
  amount: number;
  currency: string;
  currentPeriodEnd: string | null;
  razorpaySubscriptionId: string;
  features: string[];
};
type SubscriptionCancelledEmailParams = {
  firstName: string;
  planName: string;
  tier: string;
  billingCycle: string;
  currentPeriodEnd: string | null;
  cancelledImmediately: boolean;
};
type SubscriptionRenewedEmailParams = {
  firstName: string;
  planName: string;
  tier: string;
  billingCycle: string;
  amount: number;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  razorpaySubscriptionId: string;
};
type SubscriptionPaymentFailedEmailParams = {
  firstName: string;
  planName: string;
  tier: string;
  billingCycle: string;
  amount: number;
  currency: string;
  failureReason?: string;
  razorpaySubscriptionId: string;
  retryUrl?: string;
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
  paymentIdOrMethod?: string; // Legacy support
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
type SupportConfirmationEmailParams = {
  userName: string;
  subject: string;
  requestId: string;
};
type TeamInviteEmailParams = {
  recipientEmail: string;
  inviterName: string;
  teamName: string;
  organizationName: string;
  roleName: string;
  inviteLink: string;
  expiresAt: string;
};

// New Auth Email Params
type EmailVerificationParams = { firstName: string; verificationUrl: string; expiryHours: number };
type PasswordResetParams = { firstName: string; resetUrl: string; expiryMinutes: number };
type LoginNotificationParams = {
  firstName: string;
  ipAddress: string;
  deviceName: string;
  location: string;
  loginTime: string;
  securityUrl: string;
};
type PasswordChangedParams = { firstName: string; supportUrl: string; changeTime: string };
type WaitlistConfirmationParams = { name: string; position: number };
type CouponRedeemedParams = {
  userName: string;
  couponCode: string;
  creditsAwarded: number;
  planName?: string;
  durationDays?: number;
};

// Security Email Params
type MFAEnabledParams = {
  firstName: string;
  enabledAt: string;
  deviceName: string;
  ipAddress: string;
  location: string;
  securityUrl: string;
};
type MFADisabledParams = {
  firstName: string;
  disabledAt: string;
  deviceName: string;
  ipAddress: string;
  location: string;
  securityUrl: string;
};
type BackupCodesRegeneratedParams = {
  firstName: string;
  regeneratedAt: string;
  deviceName: string;
  ipAddress: string;
  location: string;
  remainingCodes: number;
  securityUrl: string;
};
type NewDeviceLoginParams = {
  firstName: string;
  loginTime: string;
  deviceName: string;
  browser: string;
  ipAddress: string;
  location: string;
  securityUrl: string;
};
type MfaOtpParams = {
  firstName: string;
  otp: string;
  expiryMinutes: number;
};
type PasskeyAddedParams = {
  firstName: string;
  passkeyName: string;
  securityUrl: string;
};
type SecurityKeyAddedParams = {
  firstName: string;
  keyName: string;
  addedAt: string;
  securityUrl: string;
  ipAddress?: string;
  location?: string;
  deviceName?: string;
};
type SecurityKeyRemovedParams = {
  firstName: string;
  keyName: string;
  removedAt: string;
  securityUrl: string;
  ipAddress?: string;
  location?: string;
  deviceName?: string;
};
type PasskeyRemovedParams = {
  firstName: string;
  passkeyName: string;
  securityUrl: string;
};
type BackupCodeUsedParams = {
  firstName: string;
  ipAddress: string;
  deviceName: string;
  remainingCodes: number;
  securityUrl: string;
};
type OAuthAppAuthorizedParams = {
  firstName: string;
  appName: string;
  appLogoUrl?: string;
  appDeveloper?: string;
  permissions: string[];
  authorizedAt: string;
  ipAddress: string;
  location: string;
  deviceName: string;
  revokeUrl: string;
  securityUrl: string;
};
// Collect all templates with correct types
export const emailTemplates = {
  welcome: welcomeEmailTemplate as (params: WelcomeEmailParams) => string,
  otp: otpEmailTemplate as (params: OtpEmailParams) => string,
  platformInvite: platformInviteEmailTemplate as (params: PlatformInviteEmailParams) => string,
  'account-deletion-warning': accountDeletionWarningEmailTemplate as (
    params: AccountDeletionWarningEmailParams,
  ) => string,
  'account-deletion-failed': accountDeletionFailedEmailTemplate as (
    params: AccountDeletionFailedEmailParams,
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
  'free-credits-claimed': freeCreditsClaimedEmailTemplate as (
    params: FreeCreditsClaimedEmailParams,
  ) => string,
  'phone-number-added': phoneNumberAddedEmailTemplate as (
    params: PhoneNumberAddedEmailParams,
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
  'weekly-feedback': weeklyFeedbackEmailTemplate as (params: WeeklyFeedbackEmailParams) => string,
  'support-confirmation': supportConfirmationEmailTemplate as (
    params: SupportConfirmationEmailParams,
  ) => string,
  'team-invite': teamInviteEmailTemplate as (params: TeamInviteEmailParams) => string,
  // New templates
  EMAIL_VERIFICATION: emailVerificationTemplate as (params: EmailVerificationParams) => string,
  PASSWORD_RESET: passwordResetTemplate as (params: PasswordResetParams) => string,
  LOGIN_NOTIFICATION: loginNotificationTemplate as (params: LoginNotificationParams) => string,
  PASSWORD_CHANGED: passwordChangedTemplate as (params: PasswordChangedParams) => string,
  'waitlist-confirmation': waitlistConfirmationTemplate as (
    params: WaitlistConfirmationParams,
  ) => string,
  COUPON_REDEEMED: couponRedeemedEmailTemplate as (params: CouponRedeemedParams) => string,
  // Security templates
  MFA_ENABLED: mfaEnabledTemplate as (params: MFAEnabledParams) => string,
  MFA_DISABLED: mfaDisabledTemplate as (params: MFADisabledParams) => string,
  BACKUP_CODES_REGENERATED: backupCodesRegeneratedTemplate as (
    params: BackupCodesRegeneratedParams,
  ) => string,
  NEW_DEVICE_LOGIN: newDeviceLoginTemplate as (params: NewDeviceLoginParams) => string,
  MFA_OTP: mfaOtpTemplate as unknown as (params: MfaOtpParams) => string,
  'passkey-added': passkeyAddedTemplate as (params: PasskeyAddedParams) => string,
  'passkey-removed': passkeyRemovedTemplate as (params: PasskeyRemovedParams) => string,
  'security-key-added': securityKeyAddedTemplate as (params: SecurityKeyAddedParams) => string,
  'security-key-removed': securityKeyRemovedTemplate as (
    params: SecurityKeyRemovedParams,
  ) => string,
  'backup-code-used': backupCodeUsedTemplate as (params: BackupCodeUsedParams) => string,
  'oauth-app-authorized': oauthAppAuthorizedTemplate as (
    params: OAuthAppAuthorizedParams,
  ) => string,
  // Subscription templates
  'subscription-activated': subscriptionActivatedEmailTemplate as (
    params: SubscriptionActivatedEmailParams,
  ) => string,
  'subscription-cancelled': subscriptionCancelledEmailTemplate as (
    params: SubscriptionCancelledEmailParams,
  ) => string,
  'subscription-renewed': subscriptionRenewedEmailTemplate as (
    params: SubscriptionRenewedEmailParams,
  ) => string,
  'subscription-payment-failed': subscriptionPaymentFailedEmailTemplate as (
    params: SubscriptionPaymentFailedEmailParams,
  ) => string,
};

export type TemplateType = keyof typeof emailTemplates;

interface SendEmailOptions<T extends TemplateType> {
  to: string;
  subject: string;
  templateType: T;
  templateData: Parameters<(typeof emailTemplates)[T]>[0];
  headers?: Record<string, string>;
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
}

export async function sendEmail<T extends TemplateType>(
  options: SendEmailOptions<T>,
): Promise<unknown> {
  const { to, subject, templateType, templateData, headers, attachments } = options;

  // Get HTML from template
  // @ts-ignore - TypeScript struggles with the generic type mapping here but it's safe
  const html = emailTemplates[templateType](templateData);

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
    } else if (ENV.EMAIL_PROVIDER === 'notificationapi') {
      const result = await notificationapi.send({
        type: 'fairarena_emails',
        to: {
          id: to,
          email: to,
        },
        email: {
          subject,
          html,
        },
        options: {
          email: {
            fromAddress: ENV.FROM_EMAIL_ADDRESS,
            fromName: 'FairArena',
            attachments:
              attachments && attachments.length > 0
                ? attachments.map(
                    (att) =>
                      ({
                        filename: att.filename,
                        content: Buffer.isBuffer(att.content)
                          ? att.content.toString('base64')
                          : att.content,
                        contentType: att.contentType || 'application/octet-stream',
                      }) as any,
                  )
                : undefined,
          },
        },
      });

      logger.info('Email sent successfully via NotificationAPI', { data: result });

      return result;
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
    logger.error('Failed to send email:', { err });
    throw err;
  }
}

// Legacy helpers updated to use new signature

export const sendWelcomeEmail = async (to: string, userName: string): Promise<unknown> => {
  return sendEmail({
    to,
    subject: 'Welcome to FairArena',
    templateType: 'welcome',
    templateData: { userName },
  });
};

export const sendOtpEmail = async (
  to: string,
  otp: string,
  location?: {
    city: string;
    region: string;
    country: string;
    latitude: number;
    longitude: number;
  } | null,
): Promise<unknown> => {
  return sendEmail({
    to,
    subject: 'Account Verification - FairArena',
    templateType: 'otp',
    templateData: { otp, location },
  });
};

export const sendPlatformInviteEmail = async (
  to: string,
  inviterName: string,
): Promise<unknown> => {
  const unsubscribeUrl = `${ENV.FRONTEND_URL}/api/email/unsubscribe/${encodeURIComponent(to)}`;
  return sendEmail({
    to,
    subject: "You're invited to join FairArena!",
    templateType: 'platformInvite',
    templateData: { inviterName },
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
    },
  });
};

export const sendAccountDeletionWarningEmail = async (
  to: string,
  recoveryInstructions: string,
  deadline: string,
): Promise<unknown> => {
  return sendEmail({
    to,
    subject: 'Your Account Has Been Deleted',
    templateType: 'account-deletion-warning',
    templateData: {
      recoveryInstructions,
      deadline,
    },
  });
};

export const sendAccountRecoveryEmail = async (to: string, userName?: string): Promise<unknown> => {
  return sendEmail({
    to,
    subject: 'Your Account Has Been Recovered',
    templateType: 'account-recovery',
    templateData: { userName },
  });
};

export const sendAccountPermanentDeletionEmail = async (to: string): Promise<unknown> => {
  return sendEmail({
    to,
    subject: 'Your Account Has Been Permanently Deleted',
    templateType: 'account-permanent-deletion',
    templateData: {},
  });
};

export const sendAccountDeletionFailedEmail = async (
  to: string,
  message: string,
): Promise<unknown> => {
  return sendEmail({
    to,
    subject: 'Account Deletion Failed',
    templateType: 'account-deletion-failed',
    templateData: { message },
  });
};

export const sendDataExportEmail = async (
  to: string,
  userName: string,
  exportDate: string,
  dataSize: string,
  attachments: { filename: string; content: Buffer | string; contentType?: string }[],
): Promise<unknown> => {
  return sendEmail({
    to,
    subject: 'Your FairArena Data Export',
    templateType: 'data-export',
    templateData: {
      userName,
      exportDate,
      dataSize,
    },
    attachments,
  });
};

export const sendDataExportErrorEmail = async (
  to: string,
  userName: string,
  errorMessage: string,
): Promise<unknown> => {
  return sendEmail({
    to,
    subject: 'Data Export Failed',
    templateType: 'data-export-error',
    templateData: {
      userName,
      errorMessage,
    },
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
  return sendEmail({
    to,
    subject: 'Payment Successful - FairArena',
    templateType: 'payment-success',
    templateData: {
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
    },
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
  return sendEmail({
    to,
    subject: 'Payment Failed - FairArena',
    templateType: 'payment-failed',
    templateData: {
      userName,
      planName,
      amount,
      currency,
      orderId,
      paymentId,
      failureReason,
      transactionDate,
    },
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
  return sendEmail({
    to,
    subject: 'Refund Initiated - FairArena',
    templateType: 'refund-initiated',
    templateData: {
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
    },
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
  return sendEmail({
    to,
    subject: 'Refund Completed - FairArena',
    templateType: 'refund-completed',
    templateData: {
      userName,
      planName,
      refundAmount,
      currency,
      orderId,
      paymentId,
      refundId,
      completedDate,
      paymentMethod,
    },
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
  return sendEmail({
    to,
    subject: 'Refund Failed - FairArena',
    templateType: 'refund-failed',
    templateData: {
      userName,
      planName,
      refundAmount,
      currency,
      orderId,
      paymentId,
      refundId,
      failureReason,
      failureDate,
    },
  });
};

export const sendFreeCreditsClaimedEmail = async (
  to: string,
  userName: string,
  creditsAdded: number,
  newBalance: number,
): Promise<unknown> => {
  return sendEmail({
    to,
    subject: 'Congratulations! Free Credits Claimed - FairArena',
    templateType: 'free-credits-claimed',
    templateData: {
      userName,
      creditsAdded,
      newBalance,
    },
  });
};

export const sendCouponRedeemedEmail = async (
  to: string,
  userName: string,
  couponCode: string,
  creditsAwarded: number,
  planName?: string,
  durationDays?: number,
): Promise<unknown> => {
  return sendEmail({
    to,
    subject: 'Coupon Redeemed Successfully! - FairArena',
    templateType: 'COUPON_REDEEMED',
    templateData: { userName, couponCode, creditsAwarded, planName, durationDays },
  });
};

export const sendPhoneNumberAddedEmail = async (
  to: string,
  userName: string,
  phoneNumber: string,
): Promise<unknown> => {
  return sendEmail({
    to,
    subject: 'Phone Number Added to Your Account - FairArena',
    templateType: 'phone-number-added',
    templateData: {
      userName,
      phoneNumber,
    },
  });
};

export const sendPasskeyAddedEmail = async (
  to: string,
  firstName: string,
  passkeyName: string,
): Promise<unknown> => {
  return sendEmail({
    to,
    subject: 'New Passkey Added - FairArena',
    templateType: 'passkey-added',
    templateData: {
      firstName,
      passkeyName,
      securityUrl: `${ENV.FRONTEND_URL}/dashboard/account-settings`,
    },
  });
};

export const sendPasskeyRemovedEmail = async (
  to: string,
  firstName: string,
  passkeyName: string,
): Promise<unknown> => {
  return sendEmail({
    to,
    subject: 'Passkey Removed - FairArena',
    templateType: 'passkey-removed',
    templateData: {
      firstName,
      passkeyName,
      securityUrl: `${ENV.FRONTEND_URL}/dashboard/account-settings`,
    },
  });
};

export const sendBackupCodeUsedEmail = async (
  to: string,
  firstName: string,
  ipAddress: string,
  deviceName: string,
  remainingCodes: number,
): Promise<unknown> => {
  return sendEmail({
    to,
    subject: 'Security Alert: Backup Code Used - FairArena',
    templateType: 'backup-code-used',
    templateData: {
      firstName,
      ipAddress,
      deviceName,
      remainingCodes,
      securityUrl: `${ENV.FRONTEND_URL}/dashboard/account-settings`,
    },
  });
};
