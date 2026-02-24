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

export const couponRedeemedEmailTemplate = (params: {
  userName: string;
  couponCode: string;
  creditsAwarded: number;
  planName?: string;
  durationDays?: number;
}): string => {
  const dashboardUrl = ENV.FRONTEND_URL + '/dashboard';
  const currentYear = new Date().getFullYear();

  let awardDetails = '';
  if (params.creditsAwarded > 0) {
    awardDetails += `<strong style="color: #d9ff00; background-color: #1a1a1a; padding: 2px 8px; border-radius: 4px;">${params.creditsAwarded} credits</strong>`;
  }

  if (params.planName && params.durationDays) {
    if (awardDetails) awardDetails += ' and ';
    awardDetails += `<strong style="color: #1a1a1a; background-color: #fef3c7; padding: 2px 8px; border-radius: 4px;">${params.planName} (${params.durationDays} days)</strong>`;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coupon Redeemed Successfully - FairArena</title>
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
          <tr>
            <td align="center" style="padding: 40px 40px 0;">
              <img src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9a8100146eb9293f/view?project=69735edc00127d2033d8&mode=admin" alt="FairArena" style="height: 40px;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 24px;">
              <div style="width: 80px; height: 80px; background-color: #d9ff00; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                <span style="font-size: 40px; color: #1a1a1a; font-weight: bold; line-height: 80px;">🎁</span>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 40px 16px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1a1a1a; line-height: 1.2;">Success! Coupon Redeemed</h1>
              <p style="margin: 12px 0 0; font-size: 16px; color: #666666;">Code: <strong>${params.couponCode}</strong></p>
            </td>
          </tr>
          <tr>
            <td class="content" style="padding: 32px 40px;">
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333333;">Hi <strong>${params.userName}</strong>,</p>
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 1.6; color: #555555;">Awesome news! Your coupon has been successfully redeemed. We've added ${awardDetails} to your account.</p>

              <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 32px; border: 1px solid #e5e7eb; text-align: center;">
                <p style="margin: 0 0 8px; font-size: 14px; color: #666666; text-transform: uppercase; letter-spacing: 1px;">Current Status</p>
                <p style="margin: 0; font-size: 18px; font-weight: 700; color: #1a1a1a;">Ready to use for AI features & more</p>
              </div>

              <div style="text-align: center;">
                <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 32px; background-color: #1a1a1a; color: #d9ff00; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px;">Explore Dashboard</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #9ca3af;">© ${currentYear} FairArena. All rights reserved.</p>
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
