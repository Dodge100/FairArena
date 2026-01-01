import { ENV } from '../../config/env.js';

export const dataExportErrorEmailTemplate = (params: {
  userName: string;
  errorMessage: string;
}): string => {
  const dashboardUrl = ENV.FRONTEND_URL + '/dashboard/account-settings';
  const supportUrl = ENV.FRONTEND_URL + '/support';
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>Data Export Failed</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    table { border-collapse: collapse; border-spacing: 0; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .content { padding: 24px !important; }
      .button { padding: 14px 24px !important; font-size: 16px !important; }
      h1 { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #f4f4f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f7;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); border-radius: 8px 8px 0 0;">
              <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; line-height: 1.3;">⚠️ Data Export Failed</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="content" style="padding: 40px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333;">Hi <strong>${params.userName}</strong>,</p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #555555;">We encountered an issue while processing your data export request. Our team has been notified and is working to resolve this.</p>

              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 24px 0;">
                <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #dc2626;">Error Details</h3>
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #dc2626;">
                  ${params.errorMessage}
                </p>
              </div>

              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #555555;">Don't worry - your data is safe and secure. You can try requesting your data export again, or contact our support team for assistance.</p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 8px 0 16px;">
                    <a href="${dashboardUrl}" class="button" style="display: inline-block; padding: 16px 32px; background-color: #667eea; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 6px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">Try Again</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 8px 0 32px;">
                    <a href="${supportUrl}" class="button" style="display: inline-block; padding: 16px 32px; background-color: #6b7280; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 6px;">Contact Support</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px; font-size: 15px; line-height: 1.6; color: #555555;">Need immediate help? Reply to this email or visit our <a href="${supportUrl}" style="color: #667eea; text-decoration: underline;">support center</a>.</p>
              <p style="margin: 24px 0 0; font-size: 15px; line-height: 1.6; color: #555555;">Best regards,<br><strong>The FairArena Team</strong></p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.5; color: #6b7280; text-align: center;">© ${currentYear} FairArena. All rights reserved.</p>
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9ca3af; text-align: center;">You're receiving this email because you requested a data export from FairArena.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};
