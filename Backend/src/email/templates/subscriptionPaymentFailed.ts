import { ENV } from '../../config/env.js';

export const subscriptionPaymentFailedEmailTemplate = (params: {
  firstName: string;
  planName: string;
  tier: string;
  billingCycle: string;
  amount: number;
  currency: string;
  failureReason?: string;
  razorpaySubscriptionId: string;
  retryUrl?: string;
}): string => {
  const subscriptionUrl = `${ENV.FRONTEND_URL}/dashboard/subscription`;
  const supportUrl = `${ENV.FRONTEND_URL}/support`;
  const currentYear = new Date().getFullYear();

  const formattedAmount = (params.amount / 100).toFixed(2);
  const billingLabel = params.billingCycle === 'YEARLY' ? 'year' : 'month';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Payment Failed — FairArena</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    table { border-collapse: collapse; border-spacing: 0; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
          style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">

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
                  <td width="72" height="72" align="center" valign="middle" bgcolor="#fef2f2" style="width: 72px; height: 72px; background-color: #fef2f2; border: 2px solid #fecaca; border-radius: 50%;">
                    <span style="font-size: 32px; line-height: 72px;">⚠️</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td align="center" style="padding: 24px 40px 8px;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #1a1a1a;">
                Subscription Payment Failed
              </h1>
              <p style="margin: 10px 0 0; font-size: 15px; color: #6b7280;">
                We couldn't charge your payment method for ${params.planName}.
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi <strong>${params.firstName}</strong>,
              </p>

              <!-- Alert -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px; font-size: 15px; font-weight: 600; color: #991b1b;">
                      Action required to keep your subscription active
                    </p>
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #b91c1c;">
                      Razorpay was unable to process your ${params.billingCycle.toLowerCase()} payment of
                      <strong>₹${formattedAmount}</strong> for your ${params.planName} subscription.
                      ${params.failureReason ? `<br><br><em>Reason: ${params.failureReason}</em>` : ''}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Details -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Plan</td>
                        <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">${params.planName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Amount</td>
                        <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">₹${formattedAmount} / ${billingLabel}</td>
                      </tr>
                      <tr style="border-top: 1px solid #e5e7eb;">
                        <td style="padding: 10px 0 0; font-size: 12px; color: #9ca3af;">Subscription ID</td>
                        <td align="right" style="padding: 10px 0 0; font-size: 11px; color: #9ca3af; font-family: monospace;">${params.razorpaySubscriptionId}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What to do -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #92400e;">What to do</h3>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 5px 0; font-size: 14px; color: #78350f;">
                          <span style="margin-right: 8px;">1.</span>
                          Ensure your payment method has sufficient funds
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; font-size: 14px; color: #78350f;">
                          <span style="margin-right: 8px;">2.</span>
                          Check that your card/UPI is not expired or blocked
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; font-size: 14px; color: #78350f;">
                          <span style="margin-right: 8px;">3.</span>
                          Razorpay will retry the charge automatically
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; font-size: 14px; color: #78350f;">
                          <span style="margin-right: 8px;">4.</span>
                          If retries fail, your subscription will be halted
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="${subscriptionUrl}" style="display: inline-block; padding: 13px 32px; background-color: #dc2626; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                      Update Payment Method
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">
                Need help? <a href="${supportUrl}" style="color: #1a1a1a; font-weight: 600;">Contact support</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                © ${currentYear} FairArena. All rights reserved.
              </p>
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
