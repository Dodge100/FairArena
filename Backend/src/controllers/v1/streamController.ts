/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { Request, Response } from 'express';
import { getSession } from '../../services/auth.service.js';
import { subscribeToStream } from '../../services/stream.service.js';
import logger from '../../utils/logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const CONNECTION_TTL = 3600; // 1 hour in seconds

// ============================================================================
// TYPES
// ============================================================================

export interface StreamEvent {
  type: string;
  data: any;
}

// ============================================================================
// UNIFIED STREAM CONTROLLER
// ============================================================================

/**
 * Unified SSE stream endpoint
 * GET /api/v1/stream
 *
 * Single persistent connection for all realtime events:
 * - auth.token.refresh
 * - auth.session.revoked
 * - qr.status.update
 * - ai.chat.chunk
 * - ai.chat.complete
 * - inbox.notification.new
 * - system.heartbeat
 *
 * Note: Supporting multiple connections per session (multiple tabs)
 */
export async function stream(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const sessionId = req.user?.sessionId;

  if (!userId || !sessionId) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
    return;
  }

  // Verify session is valid
  const session = await getSession(sessionId);
  if (!session) {
    res.status(401).json({
      success: false,
      message: 'Invalid session',
    });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  logger.info('SSE connection established', { userId, sessionId });

  // Send initial connection event
  res.write(`event: system.connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

  // Subscribe to session stream
  const unsubscribe = subscribeToStream(sessionId, (event) => {
    try {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
    } catch (error) {
      logger.error('Failed to write stream event', { error });
    }
  });

  // Heartbeat to keep connection alive
  const heartbeatInterval = setInterval(() => {
    res.write(`event: system.heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
  }, HEARTBEAT_INTERVAL);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    unsubscribe();
    logger.info('SSE connection closed', { userId, sessionId });
  });

  // Auto-close after session TTL
  const ttlTimeout = setTimeout(() => {
    clearInterval(heartbeatInterval);
    unsubscribe();
    res.write(
      `event: system.timeout\ndata: ${JSON.stringify({ message: 'Connection timeout' })}\n\n`,
    );
    res.end();
  }, CONNECTION_TTL * 1000);

  // Ensure timeout is cleared on close (if close happens before timeout)
  req.on('close', () => clearTimeout(ttlTimeout));
}

export const streamController = {
  stream,
};
