
export const passkeyRemovedTemplate = (params: {
    firstName: string;
    passkeyName: string;
    securityUrl: string;
}): string => {
    const currentYear = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Passkey Removed</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    .container { max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin: 40px auto; overflow: hidden; }
    .header { padding: 32px 40px; background-color: #E53E3E; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; }
    .content { padding: 40px; color: #333333; line-height: 1.6; }
    .alert-box { background-color: #FFF5F5; border: 1px solid #FED7D7; border-radius: 6px; padding: 20px; margin: 24px 0; }
    .button { display: inline-block; padding: 12px 24px; background-color: #2D3748; color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 6px; margin: 24px 0; font-size: 14px; }
    .footer { padding: 24px; background-color: #f9fafb; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
      <h1>Passkey Removed</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${params.firstName}</strong>,</p>
      <p>A passkey has been removed from your FairArena account.</p>

      <div class="alert-box">
        <p style="margin-bottom: 0;"><strong>Passkey Name:</strong> ${params.passkeyName}</p>
      </div>

      <p>If you did not authorize this action, please secure your account immediately.</p>

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
