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

export { sendOtpForAccountSettings } from './accountSettingsSendOtp.js';
export { createLog } from './createLog.js';
export { createOrganizationAuditLog } from './createOrganizationAuditLog.js';
export { createOrganizationRoles } from './createOrganizationRoles.js';
export { createReport } from './createReport.js';
export { creditsSendSmsOtp } from './creditsSmsOtp.js';
export { creditsSendVoiceOtp } from './creditsVoiceOtp.js';
export { dailyCleanup } from './dailyCleanup.js';
export { deleteOrganization } from './deleteOrganization.js';
export { exportUserDataHandler } from './exportUserData.js';
export { processFeedbackSubmission } from './feedbackSubmit.js';
export { subscribeToNewsletter, unsubscribeFromNewsletter } from './newsletterSubscribe.js';
export {
  deleteAllReadNotifications,
  deleteNotifications,
  markAllNotificationsAsRead,
  markNotificationsAsRead,
  markNotificationsAsUnread,
  sendNotification,
} from './notificationOperations.js';
export { paymentOrderCreated } from './payment-order-created.js';
export { paymentVerified } from './payment-verified.js';
export { paymentWebhookReceived } from './payment-webhook.js';
export { inviteToPlatform } from './platformInvite.js';
export { starProfile, unstarProfile } from './profileStars.js';
export { updateProfileFunction } from './profileUpdate.js';
export { recordProfileView } from './recordProfileView.js';
export { sendEmailHandler } from './sendEmail.js';
export { sendWeeklyFeedbackEmail } from './sendWeeklyFeedbackEmail.js';
export {
  createUserSettingsFunction,
  resetSettingsFunction,
  updateSettingsFunction,
} from './settingsOperations.js';
export { subscriptionWebhookReceived } from './subscriptionWebhook.js';
export { supportRequestCreated } from './supportRequest.js';
export { createTeamAuditLog, sendTeamInviteEmail } from './teamInvite.js';
export {
  processBulkTeamInvites,
  processSingleTeamInvite,
  processTeamInviteAcceptance,
} from './teamInviteProcessing.js';
export { createTeamFunction, deleteTeamFunction, updateTeamFunction } from './teamManagement.js';
export { updateOrganization } from './updateOrganization.js';
export { deleteUser } from './userDelete.js';
export { upsertUser } from './userOperations.js';
export { syncUser } from './userSync.js';
export { updateUser } from './userUpdate.js';

// Auth email functions
export {
  sendBackupCodeUsedHandler,
  sendEmailVerification,
  sendLoginNotification,
  sendPasskeyAddedHandler,
  sendPasskeyRemovedHandler,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
} from './authEmails.js';

// Security email functions
export {
  sendBackupCodesRegeneratedEmail,
  sendMFADisabledEmail,
  sendMFAEnabledEmail,
  sendMfaOtpEmail,
  sendNewDeviceLoginEmail,
  sendSecurityKeyAddedEmail,
  sendSecurityKeyRemovedEmail,
} from './securityEmails.js';

// OAuth background jobs
export {
  archiveOldAuditLogs,
  calculateApplicationStats,
  cleanupExpiredTokens,
  createOAuthAppAuthorizedNotification,
  logOAuthDataAccess,
  sendOAuthAppAuthorizedEmail,
} from './oauthJobs.js';

// Auth stream functions
export { emitSessionRevoked, scheduleTokenRefresh } from './authStream.js';

// AI Gateway
export { modelStatusProbe } from './modelStatusProbe.js';
