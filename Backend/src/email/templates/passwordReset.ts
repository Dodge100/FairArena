
export const passwordResetTemplate = (params: {
  firstName: string;
  resetUrl: string;
  expiryMinutes: number
}): string => {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    .container { max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin: 40px auto; overflow: hidden; }
    .header { padding: 32px 40px; background: linear-gradient(135deg, #FF512F 0%, #DD2476 100%); text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; }
    .content { padding: 40px; color: #333333; line-height: 1.6; }
    .button { display: inline-block; padding: 14px 28px; background-color: #DD2476; color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 6px; margin: 24px 0; }
    .footer { padding: 24px; background-color: #f9fafb; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
      <h1>Reset your password</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${params.firstName}</strong>,</p>
      <p>We received a request to reset the password for your FairArena account. If you made this request, click the button below to pick a new password:</p>

      <div style="text-align: center;">
        <a href="${params.resetUrl}" class="button">Reset Password</a>
      </div>

      <p style="font-size: 14px; color: #666;">This link will expire in ${params.expiryMinutes} minutes.</p>
      <p>If you didn't ask to reset your password, you can ignore this email. Your password will not change.</p>

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
