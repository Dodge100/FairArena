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

import { z } from 'zod';

/**
 * Sanitize HTML content to prevent XSS attacks
 * Custom implementation to avoid external dependencies
 */
export const sanitizeHtml = (dirty: string): string => {
  // Remove all HTML tags and potentially dangerous content
  return dirty
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*>/gi, '')
    .replace(/<link\b[^<]*>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '') // Remove all remaining HTML tags
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

/**
 * Sanitize plain text input
 */
export const sanitizeText = (input: string): string => {
  // Remove any potential script injections
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

/**
 * Sanitize object recursively
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
  const sanitized = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        sanitized[key] = sanitizeText(value) as T[Extract<keyof T, string>];
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
};

/**
 * Common Zod schemas for organization-related validation
 */
export const organizationSchemas = {
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .trim()
    .toLowerCase()
    .transform(sanitizeText),

  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim()
    .transform(sanitizeText),

  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional()
    .transform((val) => (val ? sanitizeText(val) : val)),

  timezone: z.string().optional(),

  isPublic: z.boolean().optional().default(true),

  joinEnabled: z.boolean().optional().default(false),

  page: z
    .string()
    .or(z.number())
    .transform((val) => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) || num < 1 ? 1 : num;
    }),

  limit: z
    .string()
    .or(z.number())
    .transform((val) => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      if (isNaN(num) || num < 1) return 20;
      if (num > 100) return 100; // Max 100 items per page
      return num;
    }),
};

/**
 * Validate and sanitize organization creation data
 */
export const createOrganizationSchema = z.object({
  name: organizationSchemas.name,
  slug: organizationSchemas.slug,
  joinEnabled: organizationSchemas.joinEnabled,
  isPublic: organizationSchemas.isPublic,
  timezone: organizationSchemas.timezone,
});

/**
 * Validate and sanitize organization update data
 */
export const updateOrganizationSchema = z.object({
  name: organizationSchemas.name.optional(),
  isPublic: organizationSchemas.isPublic,
  joinEnabled: organizationSchemas.joinEnabled,
});

/**
 * Validate pagination parameters
 */
export const paginationSchema = z.object({
  page: organizationSchemas.page,
  limit: organizationSchemas.limit,
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
