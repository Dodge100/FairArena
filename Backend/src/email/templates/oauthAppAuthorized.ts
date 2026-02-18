export const oauthAppAuthorizedTemplate = (params: {
  firstName: string;
  appName: string;
  appLogoUrl?: string;
  appDeveloper?: string;
  permissions: string[];
  authorizedAt: string;
  ipAddress: string;
  location: string;
  deviceName: string;
  revokeUrl: string;
  securityUrl: string;
}): string => {
  const currentYear = new Date().getFullYear();

  const permissionsList = params.permissions
    .map((p) => `<li style="margin-bottom: 4px;">${p}</li>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New App Connected to Your Account</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; }
        .container { max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin: 40px auto; overflow: hidden; }
        .header { padding: 32px 40px; background-color: #2D3748; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; }
        .content { padding: 40px; color: #333333; line-height: 1.6; }
        .app-card { background-color: #F7FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; }
        .app-logo { width: 64px; height: 64px; border-radius: 12px; object-fit: cover; margin-bottom: 12px; border: 1px solid #E2E8F0; }
        .app-logo-placeholder { width: 64px; height: 64px; border-radius: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
        .app-name { font-size: 20px; font-weight: 700; color: #2D3748; margin-bottom: 4px; }
        .app-developer { font-size: 14px; color: #718096; }
        .permissions-box { background-color: #EDF2F7; border-radius: 8px; padding: 16px; margin: 20px 0; }
        .permissions-title { font-size: 14px; font-weight: 600; color: #4A5568; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .permissions-list { list-style: none; padding-left: 0; font-size: 14px; color: #2D3748; }
        .detail-box { background-color: #FFF5F5; border: 1px solid #FED7D7; border-radius: 8px; padding: 16px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .detail-label { color: #718096; font-weight: 500; }
        .detail-value { color: #2D3748; font-weight: 600; text-align: right; }
        .button { display: inline-block; padding: 14px 28px; background-color: #E53E3E; color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 8px; margin: 8px; font-size: 14px; }
        .button-secondary { background-color: #4A5568; }
        .button-container { text-align: center; margin: 24px 0; }
        .footer { padding: 24px; background-color: #f9fafb; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
        .warning-text { font-size: 13px; color: #C53030; margin-top: 16px; padding: 12px; background-color: #FFF5F5; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9a8100146eb9293f/view?project=69735edc00127d2033d8&mode=admin" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
            <h1>New App Connected</h1>
        </div>
        <div class="content">
            <p>Hi <strong>${params.firstName}</strong>,</p>
            <p style="margin-top: 12px;">A new application was granted access to your FairArena account.</p>

            <div class="app-card">
                ${
                  params.appLogoUrl
                    ? `<img src="${params.appLogoUrl}" alt="${params.appName}" class="app-logo" />`
                    : `<div class="app-logo-placeholder"><span style="color: white; font-size: 24px; font-weight: bold;">${params.appName.charAt(0).toUpperCase()}</span></div>`
                }
                <div class="app-name">${params.appName}</div>
                ${params.appDeveloper ? `<div class="app-developer">by ${params.appDeveloper}</div>` : ''}
            </div>

            <div class="permissions-box">
                <div class="permissions-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A5568" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                    Permissions granted:
                </div>
                <ul class="permissions-list">
                    ${permissionsList}
                </ul>
            </div>

            <div class="detail-box">
                <div class="detail-row">
                    <span class="detail-label">When</span>
                    <span class="detail-value">${new Date(params.authorizedAt).toLocaleString()}</span>
                </div>
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
            </div>

            <div class="button-container">
                <a href="${params.revokeUrl}" class="button">Revoke Access</a>
                <a href="${params.securityUrl}" class="button button-secondary">Review Security</a>
            </div>

            <p class="warning-text">
                <strong>Didn't authorize this?</strong> If you don't recognize this activity, click "Revoke Access" immediately and change your password.
            </p>
        </div>
        <div class="footer">
            <p>This email was sent because an app was granted access to your account.</p>
            <p style="margin-top: 8px;">&copy; ${currentYear} FairArena. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `.trim();
};
