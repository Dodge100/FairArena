import { ENV } from '../../config/env.js';

export const subscriptionCancelledEmailTemplate = (params: {
  firstName: string;
  planName: string;
  tier: string;
  billingCycle: string;
  currentPeriodEnd: string | null;
  cancelledImmediately: boolean;
}): string => {
  const subscriptionUrl = `${ENV.FRONTEND_URL}/dashboard/subscription`;
  const supportUrl = `${ENV.FRONTEND_URL}/support`;
  const currentYear = new Date().getFullYear();

  const accessText = params.cancelledImmediately
    ? 'Your access has been revoked immediately.'
    : params.currentPeriodEnd
      ? `You'll keep full access to all ${params.planName} features until <strong>${new Date(params.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.`
      : 'You retain access until the end of your current billing period.';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Cancelled — FairArena</title>
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
                  <td width="72" height="72" align="center" valign="middle" bgcolor="#fee2e2" style="width: 72px; height: 72px; background-color: #fee2e2; border-radius: 50%;">
                    <span style="font-size: 32px; line-height: 72px;">📋</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td align="center" style="padding: 24px 40px 8px;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #1a1a1a;">
                Subscription Cancelled
              </h1>
              <p style="margin: 10px 0 0; font-size: 15px; color: #6b7280;">
                Your ${params.planName} subscription has been cancelled.
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi <strong>${params.firstName}</strong>,
              </p>

              <!-- Access Info -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background-color: ${params.cancelledImmediately ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${params.cancelledImmediately ? '#fecaca' : '#bbf7d0'}; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: ${params.cancelledImmediately ? '#991b1b' : '#065f46'};">
                      ${accessText}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.7; color: #555555;">
                This cancellation was processed by our backend servers after receiving a confirmed cancellation event from Razorpay. No further charges will be made to your payment method.
              </p>

              <!-- What happens next -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #1a1a1a;">What happens next</h3>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 5px 0; font-size: 14px; color: #374151;">
                          <span style="color: #6b7280; margin-right: 8px;">→</span>
                          No further charges will be made
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; font-size: 14px; color: #374151;">
                          <span style="color: #6b7280; margin-right: 8px;">→</span>
                          Credits purchased separately remain in your account
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; font-size: 14px; color: #374151;">
                          <span style="color: #6b7280; margin-right: 8px;">→</span>
                          You can resubscribe anytime from your dashboard
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; font-size: 14px; color: #374151;">
                          <span style="color: #6b7280; margin-right: 8px;">→</span>
                          Your account data is preserved
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
                    <a href="${subscriptionUrl}" style="display: inline-block; padding: 13px 32px; background-color: #1a1a1a; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                      View Plans & Resubscribe
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">
                If you didn't request this cancellation, please <a href="${supportUrl}" style="color: #1a1a1a; font-weight: 600;">contact support immediately</a>.
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
