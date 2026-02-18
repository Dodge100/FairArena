import { ENV } from '../../config/env.js';

export const subscriptionRenewedEmailTemplate = (params: {
  firstName: string;
  planName: string;
  tier: string;
  billingCycle: string;
  amount: number;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  razorpaySubscriptionId: string;
}): string => {
  const dashboardUrl = `${ENV.FRONTEND_URL}/dashboard`;
  const subscriptionUrl = `${ENV.FRONTEND_URL}/dashboard/subscription`;
  const supportUrl = `${ENV.FRONTEND_URL}/support`;
  const currentYear = new Date().getFullYear();

  const formattedAmount = (params.amount / 100).toFixed(2);
  const billingLabel = params.billingCycle === 'YEARLY' ? 'year' : 'month';

  const tierColors: Record<string, string> = {
    STARTER: '#3b82f6',
    PRO: '#8b5cf6',
    TEAM: '#f59e0b',
    ENTERPRISE: '#ef4444',
  };
  const accentColor = tierColors[params.tier] ?? '#6366f1';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Renewed — FairArena</title>
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
              <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" alt="FairArena" style="height: 40px;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td width="72" height="72" align="center" valign="middle" bgcolor="${accentColor}" style="width: 72px; height: 72px; background-color: ${accentColor}; border-radius: 50%;">
                    <span style="font-size: 32px; line-height: 72px; color: #ffffff;">🔄</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td align="center" style="padding: 24px 40px 8px;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #1a1a1a;">
                Subscription Renewed
              </h1>
              <p style="margin: 10px 0 0; font-size: 15px; color: #6b7280;">
                Your ${params.planName} has been automatically renewed.
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi <strong>${params.firstName}</strong>,
              </p>

              <!-- Renewal Summary -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background-color: #f8f9fa; border: 1px solid ${accentColor}30; border-radius: 10px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 700; color: #1a1a1a; text-transform: uppercase; letter-spacing: 0.5px;">Renewal Receipt</h2>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Plan</td>
                        <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">${params.planName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Amount Charged</td>
                        <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">₹${formattedAmount} / ${billingLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Period Start</td>
                        <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">
                          ${new Date(params.currentPeriodStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </td>
                      </tr>
                      ${
                        params.currentPeriodEnd
                          ? `
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Next Renewal</td>
                        <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">
                          ${new Date(params.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </td>
                      </tr>
                      `
                          : ''
                      }
                      <tr>
                        <td colspan="2" style="padding-top: 12px; border-top: 1px solid #e5e7eb;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="font-size: 12px; color: #9ca3af;">Subscription ID</td>
                              <td align="right" style="font-size: 11px; color: #9ca3af; font-family: monospace;">${params.razorpaySubscriptionId}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.7; color: #555555;">
                This renewal was automatically processed by Razorpay and confirmed by our backend via webhook signature verification. Your subscription continues uninterrupted.
              </p>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 13px 32px; background-color: #1a1a1a; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; margin-right: 12px;">
                      Go to Dashboard
                    </a>
                    <a href="${subscriptionUrl}" style="display: inline-block; padding: 13px 32px; background-color: transparent; color: #1a1a1a; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; border: 2px solid #e5e7eb;">
                      Manage Subscription
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">
                Didn't expect this charge? <a href="${supportUrl}" style="color: #1a1a1a; font-weight: 600;">Contact support</a>
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
