import { requireAuth } from '@clerk/express';
import { Router } from 'express';
import { aiController } from '../../controllers/v1/ai.controller.js';

const router = Router();

// All routes require authentication for security
router.use(requireAuth());

/**
 * @swagger
 * /api/v1/ai/stream:
 *   post:
 *     summary: Stream AI chat response
 *     description: Send a message to the AI assistant and receive a streaming response using Server-Sent Events (SSE)
 *     tags: [AI Assistant]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *               - sessionId
 *             properties:
 *               message:
 *                 type: string
 *                 description: User's message to the AI
 *                 example: "How do I update my profile?"
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *                 description: Chat session ID for conversation continuity
 *               metadata:
 *                 type: object
 *                 description: Additional context information
 *                 properties:
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   pageContext:
 *                     type: object
 *                     properties:
 *                       route:
 *                         type: string
 *                       title:
 *                         type: string
 *                       content:
 *                         type: string
 *                   debugInfo:
 *                     type: object
 *                     properties:
 *                       consoleLogs:
 *                         type: array
 *                         items:
 *                           type: object
 *                       errors:
 *                         type: array
 *                         items:
 *                           type: object
 *     responses:
 *       200:
 *         description: Streaming response (text/event-stream)
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: |
 *                 Server-Sent Events stream with the following event types:
 *                 - `data: {"type": "chunk", "content": "text"}` - Partial response chunk
 *                 - `data: {"type": "complete"}` - Stream completed successfully
 *                 - `data: {"type": "error", "error": "message"}` - Error occurred
 *             examples:
 *               streamingResponse:
 *                 value: |
 *                   data: {"type":"chunk","content":"To update"}
 *                   data: {"type":"chunk","content":" your profile,"}
 *                   data: {"type":"chunk","content":" go to Settings"}
 *                   data: {"type":"complete"}
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/stream', (req, res) => aiController.streamChat(req, res));

/**
 * @swagger
 * /api/v1/ai/chat:
 *   post:
 *     summary: Send AI chat message (non-streaming)
 *     description: Send a message to the AI assistant and receive a complete response (fallback for non-streaming clients)
 *     tags: [AI Assistant]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *               - sessionId
 *             properties:
 *               message:
 *                 type: string
 *                 description: User's message to the AI
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *                 description: Chat session ID
 *               metadata:
 *                 type: object
 *                 description: Additional context information
 *           examples:
 *             chatRequest:
 *               value:
 *                 message: "What features does FairArena offer?"
 *                 sessionId: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: AI response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                   description: AI's complete response
 *                 sessionId:
 *                   type: string
 *                   format: uuid
 *             examples:
 *               chatResponse:
 *                 value:
 *                   response: "FairArena offers profile management, organization creation, team collaboration, and more."
 *                   sessionId: "550e8400-e29b-41d4-a716-446655440000"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/chat', (req, res) => aiController.chat(req, res));

/**
 * @swagger
 * /api/v1/ai/session/{sessionId}:
 *   delete:
 *     summary: Clear AI session memory
 *     description: Clear the conversation history and memory for a specific AI chat session
 *     tags: [AI Assistant]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID to clear
 *     responses:
 *       200:
 *         description: Session cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Session cleared successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/session/:sessionId', (req, res) => aiController.clearSession(req, res));

export default router;
