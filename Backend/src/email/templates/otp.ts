export const otpEmailTemplate = (params: { otp: string }): string => {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Verification - FairArena</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 32px 40px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { padding: 40px; }
    .otp { font-size: 32px; font-weight: bold; color: #333; text-align: center; margin: 20px 0; letter-spacing: 4px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Account Verification</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>To access your account settings, please use the following One-Time Password (OTP):</p>
      <div class="otp">${params.otp}</div>
      <p>This OTP will expire in 10 minutes. Please do not share this code with anyone.</p>
      <p>If you didn't request this verification, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; ${currentYear} FairArena. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
};
