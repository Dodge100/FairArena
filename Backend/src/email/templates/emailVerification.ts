
export const emailVerificationTemplate = (params: {
    firstName: string;
    verificationUrl: string;
    expiryHours: number
}): string => {
    const currentYear = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    .container { max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin: 40px auto; overflow: hidden; }
    .header { padding: 32px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; }
    .content { padding: 40px; color: #333333; line-height: 1.6; }
    .button { display: inline-block; padding: 14px 28px; background-color: #667eea; color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 6px; margin: 24px 0; }
    .footer { padding: 24px; background-color: #f9fafb; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Verify your email address</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${params.firstName}</strong>,</p>
      <p>Thanks for creating an account with FairArena! To complete your registration and verify your email address, please click the button below:</p>

      <div style="text-align: center;">
        <a href="${params.verificationUrl}" class="button">Verify Email Address</a>
      </div>

      <p style="font-size: 14px; color: #666;">This link will expire in ${params.expiryHours} hours.</p>
      <p>If you didn't create an account, you can safely ignore this email.</p>

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
