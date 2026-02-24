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

export const newDeviceLoginTemplate = (params: {
  firstName: string;
  loginTime: string;
  deviceName: string;
  browser: string;
  ipAddress: string;
  location: string;
  securityUrl: string;
}): string => {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Device Login Detected</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    .container { max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin: 40px auto; overflow: hidden; }
    .header { padding: 32px 40px; background: linear-gradient(135deg, #ED8936 0%, #DD6B20 100%); text-align: center; }
    .header-icon { width: 64px; height: 64px; margin: 0 auto 16px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; }
    .content { padding: 40px; color: #333333; line-height: 1.6; }
    .alert-box { background-color: #FFFAF0; border-left: 4px solid #ED8936; border-radius: 6px; padding: 20px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .detail-label { color: #718096; font-weight: 500; }
    .detail-value { color: #2D3748; font-weight: 600; text-align: right; word-break: break-word; }
    .button-primary { display: inline-block; padding: 12px 24px; background-color: #E53E3E; color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 6px; margin: 24px 8px 24px 0; font-size: 14px; }
    .button-secondary { display: inline-block; padding: 12px 24px; background-color: #3182CE; color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 6px; margin: 24px 0; font-size: 14px; }
    .footer { padding: 24px; background-color: #f9fafb; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9a8100146eb9293f/view?project=69735edc00127d2033d8&mode=admin" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
      <h1>New Device Login Detected</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${params.firstName}</strong>,</p>
      <p>We detected a login to your FairArena account from a new device. If this was you, you're all set! If not, please secure your account immediately.</p>

      <div class="alert-box">
        <div class="detail-row">
          <span class="detail-label">Time</span>
          <span class="detail-value">${params.loginTime}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Device</span>
          <span class="detail-value">${params.deviceName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Browser</span>
          <span class="detail-value">${params.browser}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Location</span>
          <span class="detail-value">${params.location}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">IP Address</span>
          <span class="detail-value">${params.ipAddress}</span>
        </div>
      </div>

      <p><strong>Was this you?</strong></p>
      <p>If you recognize this login, no action is needed. Your account is secure.</p>

      <p style="margin-top: 16px;"><strong>Don't recognize this activity?</strong></p>
      <p>If you didn't sign in from this device, someone else may have accessed your account. Take action now:</p>

      <div style="margin-top: 24px;">
        <a href="${params.securityUrl}" class="button-primary">Secure My Account</a>
        <a href="${params.securityUrl}/sessions" class="button-secondary">View Active Sessions</a>
      </div>

      <p style="margin-top: 24px; font-size: 14px; color: #718096; background-color: #F7FAFC; padding: 12px; border-radius: 6px;">
        <strong>💡 Security Tip:</strong> Enable two-factor authentication (2FA) for an extra layer of security. It makes it much harder for unauthorized users to access your account.
      </p>
    </div>
    <div class="footer">
      <p><strong>FairArena</strong></p>
      <p>&copy; ${currentYear} FairArena. All rights reserved.</p>
      <p style="margin-top: 8px;">
        <a href="https://www.fairarena.app" style="color: #3182CE; text-decoration: none;">www.fairarena.app</a>
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();
};
