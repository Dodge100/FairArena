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
 * encryption.service.test.ts
 *
 * Unit tests for AES-256-GCM encrypt/decrypt service.
 * No external deps — crypto is Node built-in.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/env.js', () => ({
  ENV: {
    MFA_ENCRYPTION_KEY: 'test-encryption-key-min-32-bytes!!',
    JWT_SECRET: 'fallback-jwt-secret-min-32-bytes!!',
  },
}));

import { decryptSecret, encryptSecret } from '../../../services/encryption.service.js';

describe('encryptSecret', () => {
  it('returns a string with iv:authTag:ciphertext format', () => {
    const encrypted = encryptSecret('hello world');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(32); // 16-byte IV → 32 hex chars
    expect(parts[1]).toHaveLength(32); // 16-byte GCM auth tag → 32 hex chars
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const e1 = encryptSecret('same input');
    const e2 = encryptSecret('same input');
    expect(e1).not.toBe(e2);
  });

  it('handles empty string', () => {
    const encrypted = encryptSecret('');
    expect(encrypted.split(':').length).toBe(3);
  });

  it('handles unicode / emoji', () => {
    const text = 'hello 🔐 world ñoño';
    const encrypted = encryptSecret(text);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(text);
  });
});

describe('decryptSecret', () => {
  it('correctly decrypts what encryptSecret produces', () => {
    const plaintext = 'my-secret-value-12345';
    expect(decryptSecret(encryptSecret(plaintext))).toBe(plaintext);
  });

  it('throws for invalid format (too few colons)', () => {
    expect(() => decryptSecret('notValidFormat')).toThrow('Invalid encrypted text format');
  });

  it('throws for format with too many colons', () => {
    // 4 parts — invalid
    expect(() => decryptSecret('a:b:c:d')).toThrow('Invalid encrypted text format');
  });

  it('throws when auth tag is tampered (GCM integrity check)', () => {
    const encrypted = encryptSecret('original secret');
    const parts = encrypted.split(':');
    // Tamper with auth tag
    parts[1] = 'a'.repeat(32);
    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });

  it('throws when ciphertext is tampered', () => {
    const encrypted = encryptSecret('original secret');
    const parts = encrypted.split(':');
    // Flip bits in ciphertext
    parts[2] = parts[2].replace(/[0-9]/g, '0');
    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });

  it('round-trips long strings', () => {
    const longText = 'A'.repeat(10000);
    expect(decryptSecret(encryptSecret(longText))).toBe(longText);
  });
});
