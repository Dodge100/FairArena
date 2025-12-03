import { ENV } from '../../config/env.js';

export const refundFailedEmailTemplate = (params: {
  userName: string;
  planName: string;
  refundAmount: number;
  currency: string;
  orderId: string;
  paymentId: string;
  refundId: string;
  failureReason: string;
  failureDate: string;
}): string => {
  const dashboardUrl = ENV.FRONTEND_URL + '/dashboard';
  const supportUrl = ENV.FRONTEND_URL + '/support';
  const currentYear = new Date().getFullYear();
  const formattedRefundAmount = (params.refundAmount / 100).toFixed(2);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refund Failed - FairArena</title>
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

          <!-- Error Badge -->
          <tr>
            <td align="center" style="padding: 40px 40px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="width: 80px; height: 80px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 50%; text-align: center; vertical-align: middle; box-shadow: 0 8px 24px rgba(239, 68, 68, 0.3);">
                    <span style="font-size: 40px; line-height: 80px; color: white; font-weight: bold;">❌</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="padding: 24px 40px 16px;">
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #1a1a1a; line-height: 1.2;">Refund Failed</h1>
              <p style="margin: 12px 0 0; font-size: 16px; color: #666666;">We couldn't process your refund</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content" style="padding: 32px 40px;">
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333333;">Hi <strong>${params.userName}</strong>,</p>
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 1.6; color: #555555;">Unfortunately, we were unable to process your refund for <strong>${params.planName}</strong>. The refund amount of <strong style="color: #ef4444; background-color: #fef2f2; padding: 2px 8px; border-radius: 4px;">₹${formattedRefundAmount}</strong> could not be completed.</p>

              <!-- Failure Details -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 20px; font-size: 18px; font-weight: 600; color: #991b1b;">Refund Failure Details</h2>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #7f1d1d;">Refund Amount</td>
                        <td align="right" style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #dc2626;">₹${formattedRefundAmount}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #7f1d1d;">Failure Reason</td>
                        <td align="right" style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #991b1b;">${params.failureReason}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #7f1d1d;">Failure Date</td>
                        <td align="right" style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #991b1b;">${params.failureDate}</td>
                      </tr>
                      <tr style="border-top: 1px solid #fecaca;">
                        <td style="padding: 12px 0 0; font-size: 14px; color: #7f1d1d;">Status</td>
                        <td align="right" style="padding: 12px 0 0; font-size: 14px; font-weight: 600; color: #dc2626;">Failed</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What Happened -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 20px; font-size: 18px; font-weight: 600; color: #1e40af;">What Happened?</h2>
                    <p style="margin: 0; font-size: 14px; line-height: 1.8; color: #1e3a8a;">The refund process encountered an issue and could not be completed. This can happen due to various reasons such as bank restrictions, payment method limitations, or technical issues.</p>
                  </td>
                </tr>
              </table>

              <!-- Reference IDs -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: 0.5px;">Reference Information</h3>
                    <p style="margin: 0 0 8px; font-size: 13px; color: #374151;"><strong>Refund ID:</strong> <code style="background-color: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${params.refundId}</code></p>
                    <p style="margin: 0 0 8px; font-size: 13px; color: #374151;"><strong>Order ID:</strong> <code style="background-color: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${params.orderId}</code></p>
                    <p style="margin: 0 0 8px; font-size: 13px; color: #374151;"><strong>Payment ID:</strong> <code style="background-color: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${params.paymentId}</code></p>
                    <p style="margin: 0; font-size: 13px; color: #374151;"><strong>Failure Date:</strong> ${params.failureDate}</p>
                  </td>
                </tr>
              </table>

              <!-- Next Steps -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 6px; margin-bottom: 32px;">
                <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #92400e;">🔄 Next Steps</h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #78350f;">
                  <li>Contact our support team for assistance</li>
                  <li>We'll investigate the issue and provide a resolution</li>
                  <li>You may be eligible for alternative refund methods</li>
                  <li>Keep this email for your records</li>
                </ul>
              </div>

              <!-- CTA Buttons -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 0 8px 0 0;">
                          <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 28px; background-color: #1a1a1a; color: #d9ff00; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px; border: 2px solid #1a1a1a;">View Dashboard</a>
                        </td>
                        <td style="padding: 0 0 0 8px;">
                          <a href="${supportUrl}" style="display: inline-block; padding: 14px 28px; background-color: #ef4444; color: white; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px; border: 2px solid #ef4444;">Contact Support</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Support -->
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #666666; text-align: center;">Need help with your refund? <a href="${supportUrl}" style="color: #ef4444; font-weight: 600; text-decoration: underline;">Contact Support</a></p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.5; color: #6b7280; text-align: center;">This is an automated notification from FairArena</p>
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
