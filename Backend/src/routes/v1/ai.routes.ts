import { requireAuth } from '@clerk/express';
import { Router } from 'express';
import { aiController } from '../../controllers/v1/ai.controller.js';

const router = Router();

// All routes require authentication for security
router.use(requireAuth());

// Stream chat endpoint (SSE)
router.post('/stream', (req, res) => aiController.streamChat(req, res));

// Regular chat endpoint (fallback)
router.post('/chat', (req, res) => aiController.chat(req, res));

// Clear session memory
router.delete('/session/:sessionId', (req, res) => aiController.clearSession(req, res));

export default router;
