export const waitlistConfirmationTemplate = (params: {
  name: string;
  position: number;
}): string => {
  const currentYear = new Date().getFullYear();
  const positionText = params.position > 0 ? `#${params.position}` : 'on the list';

  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>You're on the list!</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    table { border-collapse: collapse; border-spacing: 0; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .content { padding: 24px !important; }
      h1 { font-size: 24px !important; }
      .position-card { padding: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #f4f4f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f7;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 40px 40px 32px; background: #000000;">
              <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Welcome to the Waitlist</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="content" style="padding: 40px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333;">Hi <strong>${params.name}</strong>,</p>
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 1.6; color: #555555;">Thanks for signing up! You've secured your spot in line to join FairArena.</p>

              <!-- Position Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                <tr>
                  <td class="position-card" align="center" style="padding: 30px; background-color: #f9fafb; border: 2px dashed #e5e7eb; border-radius: 12px;">
                    <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Current Position</p>
                    <p style="margin: 0; font-size: 48px; font-weight: 800; color: #000000; line-height: 1;">${positionText}</p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #555555;">We'll notify you via this email address as soon as your account is ready for activation.</p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #555555;">In the meantime, hang tight! We're building something special.</p>

              <p style="margin: 32px 0 0; font-size: 15px; line-height: 1.6; color: #555555;">Cheers,<br><strong>The FairArena Team</strong></p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280; text-align: center;">© ${currentYear} FairArena. All rights reserved.</p>
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
