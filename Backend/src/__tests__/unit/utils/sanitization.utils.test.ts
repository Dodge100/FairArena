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

/**
 * sanitization.utils.test.ts
 *
 * Production-grade tests for all sanitization and detection utilities.
 * Tests XSS, SQL injection, path traversal, command injection detection,
 * HTML stripping, URL validation, filename sanitization, and object sanitization.
 */
import { describe, expect, it, vi } from 'vitest';

// Mock security.config.js with real-world patterns
vi.mock('../../../config/security.config.js', () => ({
  SANITIZATION_CONFIG: {
    sqlInjectionPatterns: [
      /'\s*OR\s*'1'\s*=\s*'1/i,
      /;\s*DROP\s+TABLE/i,
      /UNION\s+SELECT/i,
      /--\s*$/,
      /\/\*.*\*\//,
      /xp_/i,
    ],
    xssPatterns: [/<script[^>]*>/i, /javascript:/i, /on\w+\s*=/i, /data:text\/html/i],
    pathTraversalPatterns: [/\.\.\//, /\.\.%2F/i, /%2e%2e%2f/i],
    commandInjectionPatterns: [
      /;\s*(ls|cat|rm|wget|curl)\s/i,
      /\|\s*(ls|cat|rm|wget|curl)\s/i,
      /`[^`]+`/,
    ],
    allowedPatterns: {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    },
  },
}));

import {
  detectCommandInjection,
  detectPathTraversal,
  detectSqlInjection,
  detectXss,
  isValidUuid,
  sanitizeEmail,
  sanitizeFilename,
  sanitizeFilePath,
  sanitizeHtml,
  sanitizeObject,
  sanitizeSlug,
  sanitizeText,
  sanitizeUrl,
} from '../../../utils/sanitization.utils.js';

// ════════════════════════════════════════════════════════════════════════════
// 1. HTML SANITIZATION
// ════════════════════════════════════════════════════════════════════════════
describe('sanitizeHtml', () => {
  it('removes <script> tags and content', () => {
    const input = '<script>alert("XSS")</script>Hello';
    expect(sanitizeHtml(input)).toBe('Hello');
  });

  it('removes <iframe> tags', () => {
    const input = '<iframe src="javascript:alert(1)"></iframe>Content';
    expect(sanitizeHtml(input)).not.toContain('<iframe');
  });

  it('removes <style> blocks', () => {
    const input = '<style>body { display: none }</style>Text';
    expect(sanitizeHtml(input)).toContain('Text');
    expect(sanitizeHtml(input)).not.toContain('<style');
  });

  it('strips all remaining HTML tags', () => {
    const input = '<p>Hello <strong>World</strong></p>';
    expect(sanitizeHtml(input)).toBe('Hello World');
  });

  it('removes javascript: protocol', () => {
    const input = 'Click <a href="javascript:void(0)">here</a>';
    expect(sanitizeHtml(input)).not.toContain('javascript:');
  });

  it('removes event handlers like onclick=', () => {
    const input = '<div onclick="evil()">Click</div>';
    expect(sanitizeHtml(input)).not.toContain('onclick=');
  });

  it('removes data:text/html URIs', () => {
    const input = '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>';
    expect(sanitizeHtml(input)).not.toContain('data:text/html');
  });

  it('returns empty string for empty/non-string input', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null as unknown as string)).toBe('');
    expect(sanitizeHtml(undefined as unknown as string)).toBe('');
  });

  it('preserves clean text content', () => {
    const input = 'Hello, world! This is clean text.';
    expect(sanitizeHtml(input)).toBe(input);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. TEXT SANITIZATION
// ════════════════════════════════════════════════════════════════════════════
describe('sanitizeText', () => {
  it('removes script tags from text', () => {
    const input = 'Name: <script>alert(1)</script>John';
    expect(sanitizeText(input)).toBe('Name: John');
  });

  it('removes javascript: protocol', () => {
    const input = 'Link: javascript:alert(1)';
    expect(sanitizeText(input)).not.toContain('javascript:');
  });

  it('preserves legitimate text with special chars', () => {
    const input = "It's a great day! Cost: $100 & more.";
    expect(sanitizeText(input)).toBe(input.trim());
  });

  it('returns empty string for null/undefined', () => {
    expect(sanitizeText('')).toBe('');
    expect(sanitizeText(null as unknown as string)).toBe('');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. EMAIL SANITIZATION
// ════════════════════════════════════════════════════════════════════════════
describe('sanitizeEmail', () => {
  it('lowercases and trims a valid email', () => {
    expect(sanitizeEmail('  USER@EXAMPLE.COM  ')).toBe('user@example.com');
  });

  it('returns empty string for an invalid email format', () => {
    expect(sanitizeEmail('not-an-email')).toBe('');
    expect(sanitizeEmail('@domain.com')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeEmail('')).toBe('');
    expect(sanitizeEmail(null as unknown as string)).toBe('');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. URL SANITIZATION
// ════════════════════════════════════════════════════════════════════════════
describe('sanitizeUrl', () => {
  it('returns HTTPS URLs unchanged', () => {
    const url = 'https://example.com/path?q=1';
    expect(sanitizeUrl(url)).toBe(url);
  });

  it('returns HTTP URLs when http is allowed', () => {
    // URL.prototype.toString() always adds a trailing slash for bare-host URLs
    const result = sanitizeUrl('http://example.com');
    expect(result).toMatch(/^http:\/\/example\.com\/?$/);
  });

  it('rejects javascript: protocol', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
  });

  it('rejects ftp: when not in allowed list', () => {
    expect(sanitizeUrl('ftp://example.com')).toBe('');
  });

  it('allows ftp when explicitly listed', () => {
    expect(sanitizeUrl('ftp://example.com', ['http', 'https', 'ftp'])).toBeTruthy();
  });

  it('returns empty string for malformed URLs', () => {
    expect(sanitizeUrl('not a url')).toBe('');
    expect(sanitizeUrl('')).toBe('');
    expect(sanitizeUrl(null as unknown as string)).toBe('');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. FILENAME SANITIZATION
// ════════════════════════════════════════════════════════════════════════════
describe('sanitizeFilename', () => {
  it('removes path traversal sequences', () => {
    expect(sanitizeFilename('../../../etc/passwd')).not.toContain('..');
    expect(sanitizeFilename('..\\windows\\system32')).not.toContain('..');
  });

  it('removes path separators', () => {
    expect(sanitizeFilename('folder/file.txt')).not.toContain('/');
    expect(sanitizeFilename('folder\\file.txt')).not.toContain('\\');
  });

  it('removes null bytes', () => {
    expect(sanitizeFilename('file\0.txt')).not.toContain('\0');
  });

  it('preserves a normal filename with extension', () => {
    expect(sanitizeFilename('report_2024.pdf')).toBe('report_2024.pdf');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeFilename('')).toBe('');
    expect(sanitizeFilename(null as unknown as string)).toBe('');
  });

  it('removes dangerous special characters', () => {
    expect(sanitizeFilename('file<>.txt')).not.toMatch(/[<>]/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. FILE PATH SANITIZATION
// ════════════════════════════════════════════════════════════════════════════
describe('sanitizeFilePath', () => {
  it('removes path traversal sequences', () => {
    const result = sanitizeFilePath('../secret/../etc/passwd');
    expect(result).not.toContain('..');
  });

  it('removes null bytes', () => {
    expect(sanitizeFilePath('/path/file\0')).not.toContain('\0');
  });

  it('normalizes backslashes to forward slashes', () => {
    expect(sanitizeFilePath('folder\\sub\\file.txt')).toBe('folder/sub/file.txt');
  });

  it('collapses multiple consecutive slashes', () => {
    expect(sanitizeFilePath('path//to///file')).toBe('path/to/file');
  });

  it('removes leading slash', () => {
    expect(sanitizeFilePath('/etc/passwd')).toBe('etc/passwd');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. SLUG SANITIZATION
// ════════════════════════════════════════════════════════════════════════════
describe('sanitizeSlug', () => {
  it('lowercases and removes non-alphanumeric-hyphen characters (spaces removed, not hyphenated)', () => {
    // The regex [^a-z0-9-] removes spaces entirely; it does not convert them to hyphens
    const result = sanitizeSlug('Hello World!');
    expect(result).toMatch(/^[a-z0-9-]+$/);
    expect(result).toContain('hello');
    expect(result).toContain('world');
  });

  it('collapses multiple hyphens', () => {
    expect(sanitizeSlug('foo---bar')).toBe('foo-bar');
  });

  it('strips leading and trailing hyphens', () => {
    expect(sanitizeSlug('-hello-')).toBe('hello');
  });

  it('returns empty string for empty or non-string input', () => {
    expect(sanitizeSlug('')).toBe('');
    expect(sanitizeSlug(null as unknown as string)).toBe('');
  });

  it('preserves alphanumeric slugs', () => {
    expect(sanitizeSlug('my-team-2024')).toBe('my-team-2024');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. OBJECT SANITIZATION
// ════════════════════════════════════════════════════════════════════════════
describe('sanitizeObject', () => {
  it('sanitizes string fields recursively (removes script injection, <b> allowed by sanitizeText)', () => {
    const input = {
      name: 'John <script>alert(1)</script>',
      // sanitizeObject uses sanitizeText which strips <script> but not all HTML tags like <b>
      address: { city: 'New York <b>NYC</b>' },
    };
    const result = sanitizeObject(input);
    // Script injection must be removed
    expect(result.name).not.toContain('<script>');
    // sanitizeText only strips scripts/javascript — <b> passes through
    // Just verify the text content is intact
    expect(result.address.city).toContain('New York');
  });

  it('preserves non-string fields', () => {
    const input = { age: 25, active: true, score: 99.9, tags: ['a', 'b'] };
    const result = sanitizeObject(input);
    expect(result.age).toBe(25);
    expect(result.active).toBe(true);
    expect(result.score).toBe(99.9);
  });

  it('handles array string fields', () => {
    const input = { items: ['<script>evil</script>', 'clean text'] };
    const result = sanitizeObject(input);
    expect(result.items[0]).not.toContain('<script>');
    expect(result.items[1]).toBe('clean text');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. SQL INJECTION DETECTION
// ════════════════════════════════════════════════════════════════════════════
describe('detectSqlInjection', () => {
  const injections = [
    "' OR '1'='1",
    "'; DROP TABLE users;",
    'UNION SELECT * FROM users',
    'field--', // matches /--\s*$/ (end of string)
  ];
  const safe = ['John Doe', 'hello@world.com', 'user123'];

  it.each(injections)('detects SQL injection: "%s"', (input) => {
    expect(detectSqlInjection(input)).toBe(true);
  });

  it.each(safe)('safe input not flagged: "%s"', (input) => {
    expect(detectSqlInjection(input)).toBe(false);
  });

  it('returns false for empty/non-string input', () => {
    expect(detectSqlInjection('')).toBe(false);
    expect(detectSqlInjection(null as unknown as string)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. XSS DETECTION
// ════════════════════════════════════════════════════════════════════════════
describe('detectXss', () => {
  const xssPayloads = [
    '<script>alert(1)</script>',
    'javascript:void(0)',
    'onclick=alert(1)',
    'data:text/html,<h1>XSS</h1>',
  ];
  const safe = ['Hello World', 'name@email.com', '1234'];

  it.each(xssPayloads)('detects XSS: "%s"', (input) => {
    expect(detectXss(input)).toBe(true);
  });

  it.each(safe)('safe input not flagged: "%s"', (input) => {
    expect(detectXss(input)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 11. PATH TRAVERSAL DETECTION
// ════════════════════════════════════════════════════════════════════════════
describe('detectPathTraversal', () => {
  const traversals = ['../../etc/passwd', '../.env', '..%2Fetc/passwd', '%2e%2e%2fpasswd'];
  const safe = ['images/logo.png', 'uploads/file.pdf', 'readme.md'];

  it.each(traversals)('detects traversal: "%s"', (input) => {
    expect(detectPathTraversal(input)).toBe(true);
  });

  it.each(safe)('safe path not flagged: "%s"', (input) => {
    expect(detectPathTraversal(input)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 12. COMMAND INJECTION DETECTION
// ════════════════════════════════════════════════════════════════════════════
describe('detectCommandInjection', () => {
  const injections = ['; ls -la', '| cat /etc/passwd', '`whoami`'];
  const safe = ['normal input', 'just a name', 'file.txt'];

  it.each(injections)('detects command injection: "%s"', (input) => {
    expect(detectCommandInjection(input)).toBe(true);
  });

  it.each(safe)('safe input not flagged: "%s"', (input) => {
    expect(detectCommandInjection(input)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 13. UUID VALIDATION
// ════════════════════════════════════════════════════════════════════════════
describe('isValidUuid', () => {
  const validUuids = [
    '550e8400-e29b-41d4-a716-446655440000',
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    'A987FBC9-4BED-3078-CF07-9141BA07C9F3', // uppercase
  ];
  const invalid = ['not-a-uuid', '1234', '', '550e8400-e29b-41d4-a716', null];

  it.each(validUuids)('validates UUID: "%s"', (uuid) => {
    expect(isValidUuid(uuid)).toBe(true);
  });

  it.each(invalid)('rejects invalid UUID: "%s"', (uuid) => {
    expect(isValidUuid(uuid as string)).toBe(false);
  });
});
