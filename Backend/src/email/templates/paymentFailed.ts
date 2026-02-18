import { ENV } from '../../config/env.js';

export const paymentFailedEmailTemplate = (params: {
  userName: string;
  planName: string;
  amount: number;
  currency: string;
  orderId: string;
  paymentId?: string;
  failureReason: string;
  transactionDate: string;
}): string => {
  const pricingUrl = ENV.FRONTEND_URL + '/pricing';
  const supportUrl = ENV.FRONTEND_URL + '/support';
  const currentYear = new Date().getFullYear();
  const formattedAmount = (params.amount / 100).toFixed(2);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed - FairArena</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    table { border-collapse: collapse; border-spacing: 0; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .content { padding: 24px !important; }
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
              <img src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9a8100146eb9293f/view?project=69735edc00127d2033d8&mode=admin" alt="FairArena" style="height: 40px;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="width: 80px; height: 80px; background-color: #ef4444; border-radius: 50%; text-align: center; vertical-align: middle;">
                    <span style="font-size: 40px; line-height: 80px; color: white; font-weight: bold;">✕</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="padding: 24px 40px 16px;">
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #1a1a1a; line-height: 1.2;">Payment Failed</h1>
              <p style="margin: 12px 0 0; font-size: 16px; color: #666666;">We couldn't process your payment</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content" style="padding: 32px 40px;">
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333333;">Hi <strong>${params.userName}</strong>,</p>
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 1.6; color: #555555;">Unfortunately, your payment for <strong>${params.planName}</strong> could not be processed. Don't worry - no charges were made to your account.</p>

              <!-- Error Details -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #991b1b;">Failure Reason</h2>
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #7f1d1d;">${params.failureReason}</p>
                  </td>
                </tr>
              </table>

              <!-- Transaction Details -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 20px; font-size: 18px; font-weight: 600; color: #1a1a1a;">Transaction Details</h2>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #666666;">Plan</td>
                        <td align="right" style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">${params.planName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #666666;">Amount</td>
                        <td align="right" style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">₹${formattedAmount}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #666666;">Status</td>
                        <td align="right" style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #dc2626;">Failed</td>
                      </tr>
                      <tr style="border-top: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0 0; font-size: 14px; color: #666666;">Transaction Date</td>
                        <td align="right" style="padding: 12px 0 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">${params.transactionDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Reference IDs -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">Reference Information</h3>
                    <p style="margin: 0 0 8px; font-size: 13px; color: #78350f;"><strong>Order ID:</strong> <code style="background-color: #fef3c7; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${params.orderId}</code></p>
                    ${params.paymentId ? `<p style="margin: 0; font-size: 13px; color: #78350f;"><strong>Payment ID:</strong> <code style="background-color: #fef3c7; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${params.paymentId}</code></p>` : ''}
                  </td>
                </tr>
              </table>

              <!-- Common Solutions -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 6px; margin-bottom: 32px;">
                <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #1e40af;">💡 Common Solutions</h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #1e3a8a;">
                  <li>Check your card balance and available limit</li>
                  <li>Verify your card details are entered correctly</li>
                  <li>Ensure your card is enabled for online transactions</li>
                  <li>Try a different payment method</li>
                  <li>Contact your bank if the issue persists</li>
                </ul>
              </div>

              <!-- CTA Buttons -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 0 8px 0 0;">
                          <a href="${pricingUrl}" style="display: inline-block; padding: 14px 28px; background-color: #1a1a1a; color: #d9ff00; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px; border: 2px solid #1a1a1a;">Try Again</a>
                        </td>
                        <td style="padding: 0 0 0 8px;">
                          <a href="${supportUrl}" style="display: inline-block; padding: 14px 28px; background-color: transparent; color: #1a1a1a; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px; border: 2px solid #e5e7eb;">Contact Support</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Support Notice -->
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #666666; text-align: center;">Need assistance? Our support team is here to help. <a href="${supportUrl}" style="color: #1a1a1a; font-weight: 600; text-decoration: underline;">Get Help</a></p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.5; color: #6b7280; text-align: center;">This is an automated notification from FairArena</p>
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
