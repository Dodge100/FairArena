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
      <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
      <div class="header-icon">
        <svg width="32" height="32" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
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
        <a href="https://fair.sakshamg.me" style="color: #3182CE; text-decoration: none;">fair.sakshamg.me</a>
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();
};
