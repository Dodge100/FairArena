import { Router } from 'express';
import {
  checkStatus,
  getLogs,
  sendOtp,
  verifyOtp,
} from '../../controllers/v1/accountSettingsController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

// Send OTP
router.post('/send-otp', protectRoute, sendOtp);

// Verify OTP
router.post('/verify-otp', protectRoute, verifyOtp);

// Check verification status
router.get('/status', protectRoute, checkStatus);

// Get account logs
router.get('/logs', protectRoute, getLogs);

export default router;
