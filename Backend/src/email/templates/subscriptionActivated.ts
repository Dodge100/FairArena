/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { ENV } from '../../config/env.js';

export const subscriptionActivatedEmailTemplate = (params: {
  firstName: string;
  planName: string;
  tier: string;
  billingCycle: string;
  amount: number;
  currency: string;
  currentPeriodEnd: string | null;
  razorpaySubscriptionId: string;
  features: string[];
}): string => {
  const dashboardUrl = `${ENV.FRONTEND_URL}/dashboard`;
  const subscriptionUrl = `${ENV.FRONTEND_URL}/dashboard/subscription`;
  const supportUrl = `${ENV.FRONTEND_URL}/support`;
  const currentYear = new Date().getFullYear();

  const formattedAmount = (params.amount / 100).toFixed(2);
  const billingLabel = params.billingCycle === 'YEARLY' ? 'year' : 'month';
  const renewalText = params.currentPeriodEnd
    ? `Your subscription renews on <strong>${new Date(params.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.`
    : 'Your subscription is now active.';

  const tierColors: Record<string, string> = {
    STARTER: '#3b82f6',
    PRO: '#8b5cf6',
    TEAM: '#f59e0b',
    ENTERPRISE: '#ef4444',
  };
  const accentColor = tierColors[params.tier] ?? '#6366f1';

  const featureRows = params.features
    .map(
      (f) =>
        `<tr><td style="padding: 6px 0; font-size: 14px; color: #374151;">
          <span style="color: ${accentColor}; font-weight: bold; margin-right: 8px;">✓</span>${f}
        </td></tr>`,
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Activated — FairArena</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    table { border-collapse: collapse; border-spacing: 0; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .content { padding: 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0"
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
                  <td width="80" height="80" align="center" valign="middle" bgcolor="${accentColor}" style="width: 80px; height: 80px; background-color: ${accentColor}; border-radius: 50%;">
                    <span style="font-size: 36px; line-height: 80px; color: #ffffff;">🎉</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td align="center" style="padding: 24px 40px 8px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1a1a1a; line-height: 1.2;">
                Your <span style="color: ${accentColor};">${params.planName}</span> is Active!
              </h1>
              <p style="margin: 12px 0 0; font-size: 16px; color: #6b7280;">
                Welcome to FairArena ${params.tier.charAt(0) + params.tier.slice(1).toLowerCase()} — you're all set.
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content" style="padding: 32px 40px;">
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi <strong>${params.firstName}</strong>,
              </p>
              <p style="margin: 0 0 28px; font-size: 15px; line-height: 1.7; color: #555555;">
                Your <strong>${params.planName}</strong> subscription has been verified and activated by our backend.
                ${renewalText}
              </p>

              <!-- Plan Summary -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background-color: #f8f9fa; border: 1px solid ${accentColor}30; border-radius: 10px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #1a1a1a; text-transform: uppercase; letter-spacing: 0.5px;">
                      Plan Details
                    </h2>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Plan</td>
                        <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">${params.planName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Billing</td>
                        <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">
                          ₹${formattedAmount} / ${billingLabel}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Billing Cycle</td>
                        <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">
                          ${params.billingCycle.charAt(0) + params.billingCycle.slice(1).toLowerCase()}
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
                      <tr style="border-top: 1px solid ${accentColor}20;">
                        <td style="padding: 10px 0 0; font-size: 12px; color: #9ca3af;">Subscription ID</td>
                        <td align="right" style="padding: 10px 0 0; font-size: 11px; color: #9ca3af; font-family: monospace;">${params.razorpaySubscriptionId}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Features -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background-color: #f9fafb; border-radius: 10px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #1a1a1a;">
                      What's included in your plan
                    </h2>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${featureRows}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Note -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #1e40af;">🔒 How we keep your subscription secure</h3>
                    <p style="margin: 0; font-size: 13px; line-height: 1.7; color: #1d4ed8;">
                      Your subscription is <strong>verified exclusively by our backend servers</strong> using Razorpay's cryptographic webhook signatures — we never trust the browser or frontend to confirm payments. Every status change (activation, renewal, cancellation) is processed server-side and confirmed via HMAC-SHA256 signature verification before your account is updated.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 36px; background-color: #1a1a1a; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                      Go to Dashboard →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #9ca3af; text-align: center;">
                Manage your subscription anytime at
                <a href="${subscriptionUrl}" style="color: ${accentColor}; text-decoration: underline;">fairarena.app/dashboard/subscription</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 28px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 6px; font-size: 13px; color: #6b7280; text-align: center;">
                Questions? <a href="${supportUrl}" style="color: #1a1a1a; font-weight: 600; text-decoration: underline;">Contact Support</a>
              </p>
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
