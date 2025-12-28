import { ENV } from '../../config/env.js';

export const freeCreditsClaimedEmailTemplate = (params: { userName: string; creditsAdded: number; newBalance: number }): string => {
  const dashboardUrl = ENV.FRONTEND_URL + '/dashboard';
  const creditsUrl = ENV.FRONTEND_URL + '/credits';
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
  <title>Congratulations! Free Credits Claimed</title>
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
            <td align="center" style="padding: 32px 40px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; line-height: 1.3;">🎉 Free Credits Claimed!</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content" style="padding: 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 24px;">
                    <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151;">Hi ${params.userName},</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 24px;">
                    <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151;">Congratulations! You've successfully claimed your free credits to get started on FairArena.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 32px;">
                    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; border: 2px solid #e5e7eb;">
                      <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #1f2937;">${params.creditsAdded} Credits Added</h2>
                      <p style="margin: 0; font-size: 14px; color: #6b7280;">Your new balance: <strong>${params.newBalance} credits</strong></p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 32px;">
                    <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151;">Use these credits to explore our platform features and enhance your experience. You can view your credit balance and transaction history anytime.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center">
                          <a href="${creditsUrl}" class="button" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">View My Credits</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 24px;">
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6b7280;">If you have any questions, feel free to reach out to our support team.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">
                      <a href="${dashboardUrl}" style="color: #667eea; text-decoration: none;">Go to Dashboard</a> |
                      <a href="${supportUrl}" style="color: #667eea; text-decoration: none;">Contact Support</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">© ${currentYear} FairArena. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};
