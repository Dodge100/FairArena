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

export const teamInviteEmailTemplate = (params: {
  recipientEmail: string;
  inviterName: string;
  teamName: string;
  organizationName: string;
  roleName: string;
  inviteLink: string;
  expiresAt: string;
}) => {
  const {
    recipientEmail,
    inviterName,
    teamName,
    organizationName,
    roleName,
    inviteLink,
    expiresAt,
  } = params;

  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team Invitation - FairArena</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f6f9fc;
            color: #1a1a1a;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            color: #ffffff;
            font-size: 28px;
            font-weight: 600;
        }
        .icon {
            width: 64px;
            height: 64px;
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
            font-size: 32px;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 18px;
            color: #1a1a1a;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        .invite-details {
            background-color: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 25px 0;
            border-radius: 6px;
        }
        .invite-details h3 {
            margin: 0 0 15px 0;
            color: #667eea;
            font-size: 16px;
            font-weight: 600;
        }
        .detail-row {
            display: flex;
            margin-bottom: 12px;
            font-size: 14px;
        }
        .detail-row:last-child {
            margin-bottom: 0;
        }
        .detail-label {
            font-weight: 600;
            color: #6c757d;
            min-width: 120px;
        }
        .detail-value {
            color: #1a1a1a;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            text-decoration: none;
            padding: 16px 40px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 25px 0;
            text-align: center;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-2px);
        }
        .button-container {
            text-align: center;
        }
        .info-box {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 6px;
            font-size: 14px;
            color: #856404;
        }
        .info-box strong {
            display: block;
            margin-bottom: 5px;
        }
        .footer {
            padding: 30px;
            text-align: center;
            background-color: #f8f9fa;
            border-top: 1px solid #e9ecef;
        }
        .footer p {
            margin: 8px 0;
            color: #6c757d;
            font-size: 13px;
            line-height: 1.6;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        .divider {
            height: 1px;
            background-color: #e9ecef;
            margin: 25px 0;
        }
        .manual-link {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            margin-top: 20px;
            word-break: break-all;
            font-size: 12px;
            color: #6c757d;
            text-align: center;
        }
        .manual-link a {
            color: #667eea;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9a8100146eb9293f/view?project=69735edc00127d2033d8&mode=admin" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
            <div class="icon">👥</div>
            <h1>You've Been Invited!</h1>
        </div>

        <div class="content">
            <p class="greeting">
                Hello,<br><br>
                <strong>${inviterName}</strong> has invited you to join the <strong>${teamName}</strong> team in the <strong>${organizationName}</strong> organization on FairArena.
            </p>

            <div class="invite-details">
                <h3>Invitation Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Organization:</span>
                    <span class="detail-value">${organizationName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Team:</span>
                    <span class="detail-value">${teamName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Your Role:</span>
                    <span class="detail-value">${roleName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Invited To:</span>
                    <span class="detail-value">${recipientEmail}</span>
                </div>
            </div>

            <div class="button-container">
                <a href="${inviteLink}" class="cta-button">Accept Invitation</a>
            </div>

            <div class="info-box">
                <strong>⏰ Important:</strong>
                This invitation expires on <strong>${expiryDate}</strong>. Please accept it before then to join the team.
            </div>

            <div class="divider"></div>

            <p style="font-size: 14px; color: #6c757d; line-height: 1.6;">
                By accepting this invitation, you'll gain access to collaborate with your team members and contribute to projects within the organization.
            </p>

            <div class="manual-link">
                <p style="margin: 0 0 10px 0;">If the button doesn't work, copy and paste this link into your browser:</p>
                <a href="${inviteLink}">${inviteLink}</a>
            </div>
        </div>

        <div class="footer">
            <p><strong>FairArena</strong></p>
            <p>Building the future of collaborative development</p>
            <p>
                If you didn't expect this invitation, you can safely ignore this email.
            </p>
            <p style="margin-top: 20px;">
                <a href="${ENV.FRONTEND_URL}">Visit our website</a> |
                <a href="${ENV.FRONTEND_URL}/support">Get Support</a>
            </p>
        </div>
    </div>
</body>
</html>
  `.trim();
};
