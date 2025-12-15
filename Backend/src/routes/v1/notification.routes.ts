import { Router } from 'express';
import {
  deleteAllRead,
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  markAsUnread,
  markMultipleAsRead,
} from '../../controllers/v1/notification.controller.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: Get all notifications
 *     description: Retrieve all notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: unread
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Filter for unread notifications only
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', protectRoute, getNotifications);

/**
 * @swagger
 * /api/v1/notifications/unread/count:
 *   get:
 *     summary: Get unread notification count
 *     description: Get the count of unread notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 5
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/unread/count', protectRoute, getUnreadCount);

/**
 * @swagger
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     description: Mark a specific notification as read
 *     tags: [Notifications]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch('/:id/read', protectRoute, markAsRead);

/**
 * @swagger
 * /api/v1/notifications/{id}/unread:
 *   patch:
 *     summary: Mark notification as unread
 *     description: Mark a specific notification as unread
 *     tags: [Notifications]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification marked as unread
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch('/:id/unread', protectRoute, markAsUnread);

/**
 * @swagger
 * /api/v1/notifications/read:
 *   patch:
 *     summary: Mark multiple notifications as read
 *     description: Mark multiple notifications as read by their IDs
 *     tags: [Notifications]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - notificationIds
 *             properties:
 *               notificationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Notifications marked as read
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch('/read', protectRoute, markMultipleAsRead);

/**
 * @swagger
 * /api/v1/notifications/read/all:
 *   patch:
 *     summary: Mark all notifications as read
 *     description: Mark all notifications for the authenticated user as read
 *     tags: [Notifications]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch('/read/all', protectRoute, markAllAsRead);

/**
 * @swagger
 * /api/v1/notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     description: Delete a specific notification
 *     tags: [Notifications]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/:id', protectRoute, deleteNotification);

/**
 * @swagger
 * /api/v1/notifications/read/all:
 *   delete:
 *     summary: Delete all read notifications
 *     description: Delete all read notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: All read notifications deleted
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/read/all', protectRoute, deleteAllRead);

export default router;
