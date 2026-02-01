export const backupCodesRegeneratedTemplate = (params: {
  firstName: string;
  regeneratedAt: string;
  deviceName: string;
  ipAddress: string;
  location: string;
  remainingCodes: number;
  securityUrl: string;
}): string => {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Backup Codes Regenerated</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    .container { max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin: 40px auto; overflow: hidden; }
    .header { padding: 32px 40px; background: linear-gradient(135deg, #667EEA 0%, #5A67D8 100%); text-align: center; }
    .header-icon { width: 64px; height: 64px; margin: 0 auto 16px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; }
    .content { padding: 40px; color: #333333; line-height: 1.6; }
    .info-box { background-color: #EBF4FF; border-left: 4px solid #667EEA; border-radius: 6px; padding: 20px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .detail-label { color: #718096; font-weight: 500; }
    .detail-value { color: #2D3748; font-weight: 600; text-align: right; }
    .highlight-box { background-color: #F7FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 16px; margin: 24px 0; text-align: center; }
    .code-count { font-size: 48px; font-weight: 700; color: #667EEA; margin: 8px 0; }
    .warning-box { background-color: #FFFAF0; border: 1px solid #FBD38D; border-radius: 6px; padding: 16px; margin: 24px 0; font-size: 14px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #3182CE; color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 6px; margin: 24px 0; font-size: 14px; }
    .footer { padding: 24px; background-color: #f9fafb; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
      <div class="header-icon">
        <svg width="32" height="32" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <h1>Backup Codes Regenerated</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${params.firstName}</strong>,</p>
      <p>Your two-factor authentication backup codes have been successfully regenerated.</p>

      <div class="info-box">
        <div class="detail-row">
          <span class="detail-label">Regenerated On</span>
          <span class="detail-value">${params.regeneratedAt}</span>
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

      <div class="highlight-box">
        <p style="color: #718096; font-size: 14px; margin: 0;">New Backup Codes Generated</p>
        <div class="code-count">${params.remainingCodes}</div>
        <p style="color: #718096; font-size: 14px; margin: 0;">codes available</p>
      </div>

      <div class="warning-box">
        <strong>⚠️ Important:</strong>
        <p style="margin-top: 8px;">
          <strong>All your previous backup codes have been invalidated.</strong> Make sure you've saved your new backup codes in a secure location. Each code can only be used once.
        </p>
      </div>

      <p><strong>What are backup codes?</strong></p>
      <p style="font-size: 14px; color: #718096;">
        Backup codes are emergency access codes that let you sign in to your account if you lose access to your authenticator app. Keep them safe and treat them like passwords.
      </p>

      <p><strong>Didn't regenerate your codes?</strong></p>
      <p>If you didn't make this change, secure your account immediately:</p>

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
