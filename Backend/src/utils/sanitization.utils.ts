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

import { SANITIZATION_CONFIG } from '../config/security.config.js';

/**
 * Sanitize HTML content using allowlist approach
 * Removes all HTML tags and potentially dangerous content
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') return '';

  // Remove all dangerous patterns
  let clean = dirty;

  // Remove script tags and content
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove iframe tags
  clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // Remove object tags
  clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');

  // Remove embed tags
  clean = clean.replace(/<embed\b[^>]*>/gi, '');

  // Remove link tags
  clean = clean.replace(/<link\b[^>]*>/gi, '');

  // Remove style tags
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove all remaining HTML tags
  clean = clean.replace(/<[^>]*>/g, '');

  // Remove javascript: protocol
  clean = clean.replace(/javascript:/gi, '');

  // Remove event handlers
  clean = clean.replace(/on\w+\s*=/gi, '');

  // Remove data: URIs (potential XSS vector)
  clean = clean.replace(/data:text\/html/gi, '');

  return clean.trim();
}

/**
 * Sanitize plain text input
 * Removes potential script injections while preserving text
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return '';

  let clean = input;

  // Remove script tags
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove javascript: protocol
  clean = clean.replace(/javascript:/gi, '');

  // Remove event handlers
  clean = clean.replace(/on\w+\s*=/gi, '');

  return clean.trim();
}

/**
 * Detect SQL injection patterns
 * Returns true if potential SQL injection is detected
 */
export function detectSqlInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  return SANITIZATION_CONFIG.sqlInjectionPatterns.some((pattern) => pattern.test(input));
}

/**
 * Detect XSS patterns
 * Returns true if potential XSS is detected
 */
export function detectXss(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  return SANITIZATION_CONFIG.xssPatterns.some((pattern) => pattern.test(input));
}

/**
 * Detect path traversal attempts
 * Returns true if potential path traversal is detected
 */
export function detectPathTraversal(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  return SANITIZATION_CONFIG.pathTraversalPatterns.some((pattern) => pattern.test(input));
}

/**
 * Detect command injection attempts
 * Returns true if potential command injection is detected
 */
export function detectCommandInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  return SANITIZATION_CONFIG.commandInjectionPatterns.some((pattern) => pattern.test(input));
}

/**
 * Sanitize filename for safe file operations
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') return '';

  // Remove path traversal attempts
  // Remove path traversal attempts
  let clean = filename.replace(/\.\.\//g, '');
  clean = clean.replace(/\.\.\\/g, '');

  // Remove path separators
  clean = clean.replace(/[\/\\]/g, '');

  // Remove null bytes
  clean = clean.replace(/\0/g, '');

  // Remove control characters
  clean = clean.replace(/[\x00-\x1f\x80-\x9f]/g, '');

  // Remove special characters that could cause issues
  clean = clean.replace(/[<>:"|?*]/g, '');

  // Limit length
  if (clean.length > 255) {
    const ext = clean.split('.').pop() || '';
    const name = clean.substring(0, 255 - ext.length - 1);
    clean = `${name}.${ext}`;
  }

  return clean.trim();
}

/**
 * Sanitize file path
 */
export function sanitizeFilePath(path: string): string {
  if (!path || typeof path !== 'string') return '';

  // Remove path traversal attempts
  // Remove path traversal attempts
  let clean = path.replace(/\.\.\//g, '');
  clean = clean.replace(/\.\.\\/g, '');

  // Remove null bytes
  clean = clean.replace(/\0/g, '');

  // Normalize path separators to forward slashes
  clean = clean.replace(/\\/g, '/');

  // Remove multiple consecutive slashes
  clean = clean.replace(/\/+/g, '/');

  // Remove leading slash if present
  clean = clean.replace(/^\//, '');

  return clean;
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';

  // Convert to lowercase
  let clean = email.toLowerCase().trim();

  // Remove any HTML tags
  clean = sanitizeHtml(clean);

  // Basic email format validation
  if (!SANITIZATION_CONFIG.allowedPatterns.email.test(clean)) {
    return '';
  }

  return clean;
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string, allowedProtocols: string[] = ['http', 'https']): string {
  if (!url || typeof url !== 'string') return '';

  try {
    const urlObj = new URL(url);

    // Check if protocol is allowed
    const protocol = urlObj.protocol.replace(':', '');
    if (!allowedProtocols.includes(protocol)) {
      return '';
    }

    return urlObj.toString();
  } catch {
    // Invalid URL
    return '';
  }
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T, deep = true): T {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = {} as T;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (typeof value === 'string') {
        sanitized[key] = sanitizeText(value) as T[Extract<keyof T, string>];
      } else if (deep && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = sanitizeObject(value, deep);
      } else if (deep && Array.isArray(value)) {
        sanitized[key] = value.map((item: any) =>
          typeof item === 'string' ? sanitizeText(item) : item,
        ) as T[Extract<keyof T, string>];
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

/**
 * Validate and sanitize slug
 */
export function sanitizeSlug(slug: string): string {
  if (!slug || typeof slug !== 'string') return '';

  let clean = slug.toLowerCase().trim();

  // Remove any non-alphanumeric characters except hyphens
  clean = clean.replace(/[^a-z0-9-]/g, '');

  // Remove multiple consecutive hyphens
  clean = clean.replace(/-+/g, '-');

  // Remove leading/trailing hyphens
  clean = clean.replace(/^-+|-+$/g, '');

  return clean;
}

/**
 * Validate UUID format
 */
export function isValidUuid(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  return SANITIZATION_CONFIG.allowedPatterns.uuid.test(uuid);
}

/**
 * Sanitize NoSQL query to prevent injection
 */
export function sanitizeNoSqlQuery(query: any): any {
  if (typeof query !== 'object' || query === null) {
    return query;
  }

  // Check for dangerous operators
  const dangerousOperators = ['$where', '$regex', '$expr'];

  for (const key in query) {
    if (dangerousOperators.includes(key)) {
      delete query[key];
    } else if (typeof query[key] === 'object' && query[key] !== null) {
      query[key] = sanitizeNoSqlQuery(query[key]);
    }
  }

  return query;
}
