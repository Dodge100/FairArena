export const otpEmailTemplate = (params: {
  otp: string;
  location?: {
    city: string;
    region: string;
    country: string;
    latitude: number;
    longitude: number;
  } | null;
}): string => {
  const currentYear = new Date().getFullYear();

  let locationInfo = '';
  let mapHtml = '';

  if (params.location && params.location.latitude && params.location.longitude) {
    const { city, region, country, latitude, longitude } = params.location;
    locationInfo = `<p><strong>Location:</strong> ${city || 'Unknown'}, ${region || 'Unknown'}, ${country || 'Unknown'}</p>`;

    mapHtml = `
      <div style="margin: 20px 0;">
        <p>The approximate location from where the request was made:</p>
        <p><a href="https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=13" style="color: #667eea; text-decoration: none;">View on OpenStreetMap</a></p>
      </div>
    `;
  } else if (params.location) {
    const { city, region, country } = params.location;
    locationInfo = `<p><strong>Location:</strong> ${city || 'Unknown'}, ${region || 'Unknown'}, ${country || 'Unknown'}</p>`;
  }

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
      <img src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9a8100146eb9293f/view?project=69735edc00127d2033d8&mode=admin" alt="FairArena" style="height: 40px; margin-bottom: 16px;" />
      <h1>Account Verification</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>To access your account settings, please use the following One-Time Password (OTP):</p>
      <div class="otp">${params.otp}</div>
      <p>This OTP will expire in 10 minutes. Please do not share this code with anyone.</p>
      ${locationInfo}
      ${mapHtml}
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
