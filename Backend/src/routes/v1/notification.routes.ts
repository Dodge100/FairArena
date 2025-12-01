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

// Get all notifications for authenticated user
router.get('/', protectRoute, getNotifications);

// Get unread count
router.get('/unread/count', protectRoute, getUnreadCount);

// Mark single notification as read
router.patch('/:id/read', protectRoute, markAsRead);

// Mark single notification as unread
router.patch('/:id/unread', protectRoute, markAsUnread);

// Mark multiple notifications as read
router.patch('/read', protectRoute, markMultipleAsRead);

// Mark all notifications as read
router.patch('/read/all', protectRoute, markAllAsRead);

// Delete a notification
router.delete('/:id', protectRoute, deleteNotification);

// Delete all read notifications
router.delete('/read/all', protectRoute, deleteAllRead);

export default router;
