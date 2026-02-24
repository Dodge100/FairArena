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

import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

// Global event emitter for stream events
// Note: This works for single-instance deployments.
// For multi-instance scaling, this should be replaced with Redis Pub/Sub (ioredis).
class StreamService extends EventEmitter {}

export const streamEmitter = new StreamService();

export interface StreamEventPayload {
  type: string;
  data: any;
}

/**
 * Publish an event to a specific session's stream
 */
export const publishToStream = async (
  sessionId: string,
  event: StreamEventPayload,
): Promise<void> => {
  try {
    const channel = `stream:${sessionId}`;
    streamEmitter.emit(channel, event);
    logger.debug('Published to stream', { sessionId, type: event.type });
  } catch (error) {
    logger.error('Failed to publish to stream', { error, sessionId });
  }
};

/**
 * Subscribe to a specific session's stream
 * Returns a cleanup function
 */
export const subscribeToStream = (
  sessionId: string,
  callback: (event: StreamEventPayload) => void,
): (() => void) => {
  const channel = `stream:${sessionId}`;

  const handler = (event: StreamEventPayload) => {
    callback(event);
  };

  streamEmitter.on(channel, handler);
  logger.debug('Subscribed to stream', { sessionId });

  // Return cleanup function
  return () => {
    streamEmitter.off(channel, handler);
    logger.debug('Unsubscribed from stream', { sessionId });
  };
};
