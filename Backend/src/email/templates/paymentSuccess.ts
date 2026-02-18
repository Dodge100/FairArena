import { ENV } from '../../config/env.js';

export const paymentSuccessEmailTemplate = (params: {
  userName: string;
  planName: string;
  amount: number;
  currency: string;
  credits: number;
  orderId: string;
  paymentId: string;
  paymentMethod: string;
  transactionDate: string;
  invoiceUrl?: string;
}): string => {
  const dashboardUrl = ENV.FRONTEND_URL + '/dashboard';
  const creditsUrl = ENV.FRONTEND_URL + '/dashboard/credits';
  const supportUrl = ENV.FRONTEND_URL + '/support';
  const currentYear = new Date().getFullYear();
  const formattedAmount = (params.amount / 100).toFixed(2);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful - FairArena</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    table { border-collapse: collapse; border-spacing: 0; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .content { padding: 24px !important; }
      .stat-box { width: 100% !important; margin-bottom: 12px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #f4f4f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td align="center" style="padding: 40px 40px 0;">
              <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" alt="FairArena" style="height: 40px;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="width: 80px; height: 80px; background-color: #d9ff00; border-radius: 50%; text-align: center; vertical-align: middle;">
                    <span style="font-size: 40px; line-height: 80px; color: #1a1a1a; font-weight: bold;">✓</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="padding: 24px 40px 16px;">
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #1a1a1a; line-height: 1.2;">Payment Successful!</h1>
              <p style="margin: 12px 0 0; font-size: 16px; color: #666666;">Thank you for your purchase</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content" style="padding: 32px 40px;">
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333333;">Hi <strong>${params.userName}</strong>,</p>
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 1.6; color: #555555;">Your payment has been successfully processed. We've added <strong style="color: #d9ff00; background-color: #1a1a1a; padding: 2px 8px; border-radius: 4px;">${params.credits} credits</strong> to your account and you're all set!</p>

              <!-- Order Summary -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 20px; font-size: 18px; font-weight: 600; color: #1a1a1a;">Order Summary</h2>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #666666;">Plan</td>
                        <td align="right" style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">${params.planName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #666666;">Amount Paid</td>
                        <td align="right" style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">₹${formattedAmount}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #666666;">Credits Awarded</td>
                        <td align="right" style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #10b981;">+${params.credits}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #666666;">Payment Method</td>
                        <td align="right" style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">${params.paymentMethod}</td>
                      </tr>
                      <tr style="border-top: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0 0; font-size: 14px; color: #666666;">Transaction Date</td>
                        <td align="right" style="padding: 12px 0 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">${params.transactionDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Transaction Details -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">Transaction Details</h3>
                    <p style="margin: 0 0 8px; font-size: 13px; color: #78350f;"><strong>Order ID:</strong> <code style="background-color: #fef3c7; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${params.orderId}</code></p>
                    <p style="margin: 0; font-size: 13px; color: #78350f;"><strong>Payment ID:</strong> <code style="background-color: #fef3c7; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${params.paymentId}</code></p>
                  </td>
                </tr>
              </table>

              <!-- CTA Buttons -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        ${
                          params.invoiceUrl
                            ? `
                        <td style="padding: 0 8px 0 0;">
                          <a href="${params.invoiceUrl}" style="display: inline-block; padding: 14px 28px; background-color: #1a1a1a; color: #d9ff00; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px; border: 2px solid #1a1a1a;">Download Invoice</a>
                        </td>
                        `
                            : ''
                        }
                        <td style="padding: 0 8px;">
                          <a href="${creditsUrl}" style="display: inline-block; padding: 14px 28px; background-color: ${params.invoiceUrl ? 'transparent' : '#1a1a1a'}; color: ${params.invoiceUrl ? '#1a1a1a' : '#d9ff00'}; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px; border: 2px solid ${params.invoiceUrl ? '#e5e7eb' : '#1a1a1a'};">View Credits</a>
                        </td>
                        <td style="padding: 0 0 0 8px;">
                          <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 28px; background-color: transparent; color: #1a1a1a; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px; border: 2px solid #e5e7eb;">Go to Dashboard</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What's Next -->
              <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; border-radius: 6px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #065f46;">What's Next?</h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #047857;">
                  <li>Create your first hackathon event</li>
                  <li>Invite participants and judges</li>
                  <li>Enable AI-powered scoring features</li>
                  <li>Track real-time leaderboards</li>
                </ul>
              </div>

              <!-- Support -->
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #666666; text-align: center;">Questions about your purchase? <a href="${supportUrl}" style="color: #1a1a1a; font-weight: 600; text-decoration: underline;">Contact Support</a></p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.5; color: #6b7280; text-align: center;">This is an automated payment receipt from FairArena</p>
              <p style="margin: 0 0 8px; font-size: 12px; line-height: 1.5; color: #9ca3af; text-align: center;">Keep this email for your records</p>
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #6b7280; text-align: center;">© ${currentYear} FairArena. All rights reserved.</p>
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
