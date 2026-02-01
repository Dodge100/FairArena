export const mfaDisabledTemplate = (params: {
  firstName: string;
  disabledAt: string;
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
  <title>Two-Factor Authentication Disabled</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    .container { max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin: 40px auto; overflow: hidden; }
    .header { padding: 32px 40px; background: linear-gradient(135deg, #F56565 0%, #E53E3E 100%); text-align: center; }
    .header-icon { width: 64px; height: 64px; margin: 0 auto 16px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; }
    .content { padding: 40px; color: #333333; line-height: 1.6; }
    .warning-box { background-color: #FFF5F5; border-left: 4px solid #F56565; border-radius: 6px; padding: 20px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .detail-label { color: #718096; font-weight: 500; }
    .detail-value { color: #2D3748; font-weight: 600; text-align: right; }
    .alert-box { background-color: #FFFAF0; border: 1px solid #FBD38D; border-radius: 6px; padding: 16px; margin: 24px 0; font-size: 14px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #E53E3E; color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 6px; margin: 24px 0; font-size: 14px; }
    .footer { padding: 24px; background-color: #f9fafb; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
      <h1>Two-Factor Authentication Disabled</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${params.firstName}</strong>,</p>
      <p>Two-factor authentication (2FA) has been disabled on your FairArena account.</p>

      <div class="warning-box">
        <div class="detail-row">
          <span class="detail-label">Disabled On</span>
          <span class="detail-value">${params.disabledAt}</span>
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

      <div class="alert-box">
        <strong>⚠️ Important Security Notice:</strong>
        <p style="margin-top: 8px;">
          Your account is now less secure without two-factor authentication. We strongly recommend re-enabling 2FA to protect your account from unauthorized access.
        </p>
      </div>

      <p><strong>Didn't disable 2FA?</strong></p>
      <p>If you didn't make this change, your account may be compromised. Secure your account immediately:</p>

      <a href="${params.securityUrl}" class="button">Secure My Account Now</a>

      <p style="margin-top: 24px; font-size: 14px; color: #718096;">
        You can re-enable two-factor authentication anytime from your security settings.
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
