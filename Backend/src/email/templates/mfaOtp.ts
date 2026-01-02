export const mfaOtpTemplate = (params: {
  firstName: string;
  otp: string;
  expiryMinutes: number;
}): string => {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Your FairArena Verification Code</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f4f7;
    }
    .container {
      max-width: 600px;
      width: 100%;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      margin: 40px auto;
      overflow: hidden;
    }
    .header {
      padding: 32px 40px;
      background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
    }
    .content {
      padding: 32px 40px 40px;
      color: #111827;
      line-height: 1.6;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 8px;
    }
    .intro {
      font-size: 15px;
      color: #4B5563;
      margin-bottom: 24px;
    }
    .code-box {
      background-color: #F3F4F6;
      border-radius: 10px;
      padding: 24px;
      text-align: center;
      margin: 24px 0 16px;
      border: 1px solid #E5E7EB;
    }
    .code-label {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6B7280;
      margin-bottom: 8px;
    }
    .code {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 0.4em;
      font-family: 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      color: #111827;
    }
    .expiry {
      font-size: 14px;
      color: #6B7280;
      margin-top: 12px;
    }
    .divider {
      border: 0;
      border-top: 1px solid #E5E7EB;
      margin: 32px 0;
    }
    .security {
      font-size: 14px;
      color: #4B5563;
      margin-bottom: 8px;
    }
    .hint {
      font-size: 13px;
      color: #6B7280;
      margin-top: 4px;
    }
    .footer {
      padding: 20px 40px 28px;
      background-color: #F9FAFB;
      border-top: 1px solid #E5E7EB;
      text-align: center;
      font-size: 12px;
      color: #9CA3AF;
    }
    .footer a {
      color: #3B82F6;
      text-decoration: none;
    }
    @media (max-width: 600px) {
      .container { margin: 16px auto; border-radius: 0; }
      .header, .content, .footer { padding-left: 20px; padding-right: 20px; }
      .code { font-size: 28px; letter-spacing: 0.3em; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
      <h1>Your Verification Code</h1>
    </div>
    <div class="content">
      <p class="greeting">Hi <strong>${params.firstName || 'User'}</strong>,</p>
      <p class="intro">
        You requested to sign in to your FairArena account using email verification.
        Use the code below to complete your sign-in:
      </p>

      <div class="code-box">
        <div class="code-label">Your one-time code</div>
        <div class="code">${params.otp}</div>
        <p class="expiry">
          This code will expire in <strong>${params.expiryMinutes ?? 5} minutes</strong>.
        </p>
      </div>

      <hr class="divider" />

      <p class="security">
        If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake.
      </p>
      <p class="hint">
        For your security, never share this code with anyone — not even FairArena staff.
      </p>
    </div>
    <div class="footer">
      <p>© ${currentYear} FairArena. All rights reserved.</p>
      <p>
        <a href="https://fair.sakshamg.me">fair.sakshamg.me</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
};
