export const mfaEnabledTemplate = (params: {
  firstName: string;
  enabledAt: string;
  deviceName: string;
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
  <title>Two-Factor Authentication Enabled</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    .container { max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin: 40px auto; overflow: hidden; }
    .header { padding: 32px 40px; background: linear-gradient(135deg, #48BB78 0%, #38A169 100%); text-align: center; }
    .header-icon { width: 64px; height: 64px; margin: 0 auto 16px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; }
    .content { padding: 40px; color: #333333; line-height: 1.6; }
    .success-box { background-color: #F0FFF4; border-left: 4px solid #48BB78; border-radius: 6px; padding: 20px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .detail-label { color: #718096; font-weight: 500; }
    .detail-value { color: #2D3748; font-weight: 600; text-align: right; }
    .info-box { background-color: #EBF8FF; border: 1px solid #BEE3F8; border-radius: 6px; padding: 16px; margin: 24px 0; font-size: 14px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #3182CE; color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 6px; margin: 24px 0; font-size: 14px; }
    .footer { padding: 24px; background-color: #f9fafb; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
      <h1>Two-Factor Authentication Enabled</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${params.firstName}</strong>,</p>
      <p>Great news! Two-factor authentication (2FA) has been successfully enabled on your FairArena account.</p>

      <div class="success-box">
        <div class="detail-row">
          <span class="detail-label">Enabled On</span>
          <span class="detail-value">${params.enabledAt}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Device</span>
          <span class="detail-value">${params.deviceName}</span>
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

      <div class="info-box">
        <strong>🔒 What this means for you:</strong>
        <ul style="margin: 12px 0 0 20px; padding: 0;">
          <li style="margin-bottom: 8px;">You'll need your authenticator app code when signing in</li>
          <li style="margin-bottom: 8px;">Your account is now more secure against unauthorized access</li>
          <li>Save your backup codes in a safe place for emergencies</li>
        </ul>
      </div>

      <p><strong>Didn't enable 2FA?</strong></p>
      <p>If you didn't make this change, your account may have been compromised. Please secure your account immediately:</p>

      <a href="${params.securityUrl}" class="button">Review Security Settings</a>

      <p style="margin-top: 24px; font-size: 14px; color: #718096;">
        This is a security notification. If you have questions, please contact our support team.
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
