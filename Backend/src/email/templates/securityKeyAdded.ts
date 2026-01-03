export const securityKeyAddedTemplate = (params: {
    firstName: string;
    keyName: string;
    addedAt: string;
    securityUrl: string;
    ipAddress?: string;
    location?: string;
    deviceName?: string;
}): string => {
    const currentYear = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Key Added</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    .container { max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin: 40px auto; overflow: hidden; }
    .header { padding: 32px 40px; background-color: #2D3748; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; }
    .content { padding: 40px; color: #333333; line-height: 1.6; }
    .alert-box { background-color: #F0FFF4; border: 1px solid #C6F6D5; border-radius: 6px; padding: 20px; margin: 24px 0; }
    .button { display: inline-block; padding: 12px 24px; background-color: #2D3748; color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 6px; margin: 24px 0; font-size: 14px; }
    .footer { padding: 24px; background-color: #f9fafb; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
    .details { margin-top: 20px; font-size: 14px; color: #666; background: #f8f9fa; padding: 15px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
      <h1>Security Key Added</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${params.firstName}</strong>,</p>
      <p>A new security key has been added to your FairArena account.</p>

      <div class="alert-box">
        <p style="margin-bottom: 0;"><strong>Key Name:</strong> ${params.keyName}</p>
        <p style="margin-bottom: 0;"><strong>Time:</strong> ${params.addedAt}</p>
      </div>

      <div class="details">
        ${params.location ? `<p><strong>Location:</strong> ${params.location}</p>` : ''}
        ${params.ipAddress ? `<p><strong>IP Address:</strong> ${params.ipAddress}</p>` : ''}
        ${params.deviceName ? `<p><strong>Device:</strong> ${params.deviceName}</p>` : ''}
      </div>

      <p>This security key can now be used for Two-Factor Authentication (MFA) when signing in.</p>

      <p>If you did not execute this action, please remove the key and change your password immediately.</p>

      <div style="text-align: center;">
        <a href="${params.securityUrl}" class="button">Review Security Settings</a>
      </div>

      <p style="margin-top: 24px;">Best regards,<br><strong>The FairArena Team</strong></p>
    </div>
    <div class="footer">
      <p>&copy; ${currentYear} FairArena. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
};
