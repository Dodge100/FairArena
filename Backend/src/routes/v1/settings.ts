import { Router } from 'express';
import {
  getSettings,
  resetSettings,
  updateSettings,
} from '../../controllers/v1/settingsController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/settings:
 *   get:
 *     summary: Get user settings
 *     description: Retrieve the authenticated user's settings. Creates default settings if they don't exist.
 *     tags: [Settings]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     wantToGetFeedbackMail:
 *                       type: boolean
 *                       description: Whether user wants to receive weekly feedback emails
 *                     notifications:
 *                       type: object
 *                       properties:
 *                         email:
 *                           type: boolean
 *                         push:
 *                           type: boolean
 *                     privacy:
 *                       type: object
 *                       properties:
 *                         showEmail:
 *                           type: boolean
 *                         showProfile:
 *                           type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', protectRoute, getSettings);

/**
 * @swagger
 * /api/v1/settings:
 *   put:
 *     summary: Update user settings
 *     description: Update the authenticated user's settings. Merges with existing settings.
 *     tags: [Settings]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wantToGetFeedbackMail:
 *                 type: boolean
 *                 description: Whether user wants to receive weekly feedback emails
 *               notifications:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: boolean
 *                   push:
 *                     type: boolean
 *               privacy:
 *                 type: object
 *                 properties:
 *                   showEmail:
 *                     type: boolean
 *                   showProfile:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Settings updated successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put('/', protectRoute, updateSettings);

/**
 * @swagger
 * /api/v1/settings/reset:
 *   post:
 *     summary: Reset settings to default
 *     description: Reset the authenticated user's settings to default values
 *     tags: [Settings]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Settings reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Settings reset to default successfully"
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/reset', protectRoute, resetSettings);

export default router;
