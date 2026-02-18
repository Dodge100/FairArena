import { ENV } from '../../config/env.js';

export const accountDeletionWarningEmailTemplate = (params: {
  recoveryInstructions: string;
  deadline: string;
}): string => {
  const signInUrl = ENV.FRONTEND_URL + '/sign-in';
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
  <title>Account Deletion Notice</title>
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
            <td align="center" style="padding: 32px 40px 24px; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); border-radius: 8px 8px 0 0;">
              <img src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9a8100146eb9293f/view?project=69735edc00127d2033d8&mode=admin" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; line-height: 1.3;">⚠️ Account Deletion Notice</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="content" style="padding: 40px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333;">Dear User,</p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #555555;">We regret to inform you that your FairArena account has been marked for deletion. This action may have been initiated due to account inactivity or other policy reasons.</p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #555555;"><strong>${params.recoveryInstructions}</strong></p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #ff6b6b; font-weight: 600;">Please note: You have ${params.deadline} from the date of this email to recover your account. After this period, all your data will be permanently deleted and cannot be recovered.</p>
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 8px 0 32px;">
                    <a href="${signInUrl}" class="button" style="display: inline-block; padding: 16px 32px; background-color: #667eea; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 6px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">Recover Account</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #555555;">If you did not initiate this deletion or believe this is an error, please contact our support team immediately.</p>
              <p style="margin: 0 0 8px; font-size: 15px; line-height: 1.6; color: #555555;">Need help? Visit our <a href="${supportUrl}" style="color: #667eea; text-decoration: underline;">support center</a> or reply to this email.</p>
              <p style="margin: 24px 0 0; font-size: 15px; line-height: 1.6; color: #555555;">Best regards,<br><strong>The FairArena Team</strong></p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.5; color: #6b7280; text-align: center;">© ${currentYear} FairArena. All rights reserved.</p>
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9ca3af; text-align: center;">You're receiving this email because your account was scheduled for deletion.</p>
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
