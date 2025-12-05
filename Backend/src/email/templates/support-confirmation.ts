import { ENV } from '../../config/env.js';

export type SupportConfirmationEmailParams = {
  userName: string;
  subject: string;
  requestId: string;
};

export const supportConfirmationEmailTemplate = (
  params: SupportConfirmationEmailParams,
): string => {
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
  <title>Support Request Received - FairArena</title>
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
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 28px; font-weight: 700; margin: 0; }
    .content { padding: 40px 30px; }
    .content h2 { color: #1a1a1a; font-size: 24px; font-weight: 600; margin-bottom: 20px; }
    .content p { color: #666666; font-size: 16px; line-height: 1.6; margin-bottom: 20px; }
    .request-details { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; }
    .request-details p { margin: 5px 0; font-size: 14px; }
    .request-details strong { color: #1a1a1a; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e1e5e9; }
    .footer p { color: #666666; font-size: 14px; margin: 5px 0; }
    .footer a { color: #667eea; text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .header, .content, .footer { padding: 20px !important; }
      .header h1 { font-size: 24px !important; }
      .content h2 { font-size: 20px !important; }
    }
  </style>
</head>
<body>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table class="container" width="600" border="0" cellpadding="0" cellspacing="0" role="presentation">
          <!-- Header -->
          <tr>
            <td class="header">
              <h1>Support Request Received</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content">
              <h2>Hi ${params.userName},</h2>
              <p>Thank you for reaching out to FairArena support! We've received your support request and our team will review it shortly.</p>

              <div class="request-details">
                <p><strong>Request ID:</strong> ${params.requestId}</p>
                <p><strong>Subject:</strong> ${params.subject}</p>
                <p><strong>Status:</strong> Received</p>
              </div>

              <p>You can track the status of your support request and view all your previous requests by visiting your <a href="${supportUrl}" style="color: #667eea;">support dashboard</a>.</p>

              <p>Our support team typically responds within 24-48 hours. We'll send you an email notification once your request has been addressed.</p>

              <p>If you have any additional information or updates regarding this request, please don't hesitate to reply to this email.</p>

              <a href="${supportUrl}" class="cta-button">View Support Dashboard</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer">
              <p><strong>FairArena Support Team</strong></p>
              <p>Questions? Contact us at <a href="mailto:fairarena.contact@gmail.com">fairarena.contact@gmail.com</a></p>
              <p>&copy; ${currentYear} FairArena. All rights reserved.</p>
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
