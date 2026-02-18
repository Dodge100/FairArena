export const loginNotificationTemplate = (params: {
  firstName: string;
  ipAddress: string;
  deviceName: string;
  location: string;
  loginTime: string;
  securityUrl: string;
}): string => {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Login Detected</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
    .container { max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin: 40px auto; overflow: hidden; }
    .header { padding: 32px 40px; background-color: #2D3748; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; }
    .content { padding: 40px; color: #333333; line-height: 1.6; }
    .alert-box { background-color: #F7FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 20px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .detail-label { color: #718096; font-weight: 500; }
    .detail-value { color: #2D3748; font-weight: 600; text-align: right; }
    .button { display: inline-block; padding: 12px 24px; background-color: #E53E3E; color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 6px; margin: 24px 0; font-size: 14px; }
    .footer { padding: 24px; background-color: #f9fafb; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9a8100146eb9293f/view?project=69735edc00127d2033d8&mode=admin" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
      <h1>New Login to FairArena</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${params.firstName}</strong>,</p>
      <p>We noticed a new login to your FairArena account. If this was you, you don't need to do anything.</p>

      <div class="alert-box">
        <div class="detail-row">
          <span class="detail-label">Device</span>
          <span class="detail-value">${params.deviceName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Location</span>
          <span class="detail-value">${params.location}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">IP Address</span>
          <span class="detail-value">${params.ipAddress}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Time</span>
          <span class="detail-value">${new Date(params.loginTime).toLocaleString()}</span>
        </div>
      </div>

      <p>If you don't recognize this activity, your password might be compromised. Please secure your account immediately.</p>

      <div style="text-align: center;">
        <a href="${params.securityUrl}" class="button">Check Activity & Secure Account</a>
      </div>

      <p style="margin-top: 24px;">Best regards,<br><strong>The FairArena Team</strong></p>
    </div>
    <div class="footer">
      <p>&copy; ${currentYear} FairArena. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
};
