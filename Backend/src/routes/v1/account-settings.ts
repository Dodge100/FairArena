import { Router } from 'express';
import {
  checkStatus,
  exportUserData,
  getLogs,
  sendOtp,
  verifyOtp,
} from '../../controllers/v1/accountSettingsController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import { verifyRecaptcha } from '../../middleware/captcha.middleware.js';

const router = Router();

// Send OTP (requires CAPTCHA)
router.post('/send-otp', protectRoute, verifyRecaptcha, sendOtp);

// Verify OTP (requires CAPTCHA)
router.post('/verify-otp', protectRoute, verifyRecaptcha, verifyOtp);

// Check verification status
router.get('/status', protectRoute, checkStatus);

// Get account logs
router.get('/logs', protectRoute, getLogs);

// Export user data
router.post('/export-data', protectRoute, exportUserData);

export default router;
