import { Router } from 'express';
import {
  getOwnProfile,
  getPublicProfile,
  updateProfile,
} from '../../controllers/v1/profileController.js';
import { getProfileViews, recordView } from '../../controllers/v1/profileViewController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import { getUploadSignature, updateProfileImage } from '../../controllers/v1/profile/imageController.js';
import { requireSettingsVerification } from '../../middleware/verification.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/profile/public/{userId}:
 *   get:
 *     summary: Get public profile by user ID
 *     description: Retrieve a user's public profile information. This endpoint is publicly accessible.
 *     tags: [Profile]
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/UserIdParam'
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   $ref: '#/components/schemas/Profile'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/public/:userId', getPublicProfile);

/**
 * @swagger
 * /api/v1/profile/me:
 *   get:
 *     summary: Get own profile
 *     description: Retrieve the authenticated user's profile information
 *     tags: [Profile]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   $ref: '#/components/schemas/Profile'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 *   put:
 *     summary: Update own profile
 *     description: Update the authenticated user's profile information
 *     tags: [Profile]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *               name:
 *                 type: string
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *               location:
 *                 type: string
 *               website:
 *                 type: string
 *                 format: uri
 *               githubUrl:
 *                 type: string
 *                 format: uri
 *               linkedinUrl:
 *                 type: string
 *                 format: uri
 *               twitterUrl:
 *                 type: string
 *                 format: uri
 *               isPublic:
 *                 type: boolean
 *           examples:
 *             updateProfile:
 *               value:
 *                 username: "johndoe"
 *                 name: "John Doe"
 *                 bio: "Software Developer passionate about open source"
 *                 location: "San Francisco, CA"
 *                 website: "https://johndoe.com"
 *                 githubUrl: "https://github.com/johndoe"
 *                 isPublic: true
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Profile updated successfully"
 *                 profile:
 *                   $ref: '#/components/schemas/Profile'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/me', protectRoute, getOwnProfile);
router.put('/me', protectRoute, updateProfile);

// Profile Image
router.get('/image/signature', protectRoute, getUploadSignature);
router.put('/image', protectRoute, requireSettingsVerification, updateProfileImage);

/**
 * @swagger
 * /api/v1/profile/{profileId}/view:
 *   post:
 *     summary: Record profile view
 *     description: Record a view on a profile for analytics purposes
 *     tags: [Profile]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ProfileIdParam'
 *     responses:
 *       200:
 *         description: View recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "View recorded successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/:profileId/view', protectRoute, recordView);

/**
 * @swagger
 * /api/v1/profile/views:
 *   get:
 *     summary: Get profile views
 *     description: Get a list of users who have viewed the authenticated user's profile
 *     tags: [Profile]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Profile views retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 views:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       viewer:
 *                         $ref: '#/components/schemas/Profile'
 *                       viewedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/views', protectRoute, getProfileViews);

export default router;
