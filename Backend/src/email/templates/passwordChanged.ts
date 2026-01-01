
export const passwordChangedTemplate = (params: {
  firstName: string;
  supportUrl: string;
  changeTime: string;
}): string => {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    .container { max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin: 40px auto; overflow: hidden; }
    .header { padding: 32px 40px; background-color: #38A169; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; }
    .content { padding: 40px; color: #333333; line-height: 1.6; }
    .info-box { background-color: #F0FFF4; border: 1px solid #C6F6D5; border-radius: 6px; padding: 16px; margin: 24px 0; color: #276749; }
    .footer { padding: 24px; background-color: #f9fafb; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
      <h1>Password Changed Successfully</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${params.firstName}</strong>,</p>
      <p>This email is to confirm that the password for your FairArena account was recently changed.</p>

      <div class="info-box">
        <p style="margin: 0;"><strong>Time of change:</strong> ${new Date(params.changeTime).toLocaleString()}</p>
      </div>

      <p>If you did not make this change, please contact our support team immediately.</p>

      <p style="margin-top: 24px;"><a href="${params.supportUrl}" style="color: #38A169; text-decoration: underline;">Contact Support</a></p>

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
