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
 * mfa.service.test.ts
 *
 * Unit tests for all pure / deterministic exports of mfa.service.ts:
 *   - encryptSecret / decryptSecret (AES-256-GCM)
 *   - generateTOTPSecret + generateEncryptedTOTPSecret
 *   - generateTOTPUri
 *   - verifyTOTPCode (mocked authenticator)
 *   - generateBackupCodes / hashBackupCodes / verifyBackupCode / formatBackupCode
 *   - generateMFASetup (integration of the above)
 *
 * QRCode.toDataURL and the live authenticator are mocked so the suite
 * runs without any network / device dependency.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────
// otplib authenticator — mock it so we control TOTP outcomes deterministically
vi.mock('otplib', () => ({
  authenticator: {
    options: {},
    generateSecret: vi.fn(() => 'JBSWY3DPEHPK3PXP'),
    keyuri: vi.fn(
      (email: string, issuer: string, secret: string) =>
        `otpauth://totp/${issuer}:${email}?secret=${secret}&issuer=${issuer}`,
    ),
    verify: vi.fn(() => true),
  },
}));

// QRCode — returns a predictable data-url
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,FAKE')),
  },
}));

// Logger — silent during tests
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), http: vi.fn() },
}));

// ENV — provide a deterministic 32-char key
vi.mock('../../../config/env.js', () => ({
  ENV: {
    MFA_ENCRYPTION_KEY: 'test-mfa-encryption-key-32-chars!!',
    NODE_ENV: 'test',
  },
}));

import { authenticator } from 'otplib';

import {
  decryptSecret,
  encryptSecret,
  formatBackupCode,
  generateBackupCodes,
  generateEncryptedTOTPSecret,
  generateMFASetup,
  generateTOTPSecret,
  generateTOTPUri,
  hashBackupCodes,
  verifyBackupCode,
  verifyTOTPCode,
} from '../../../services/mfa.service.js';

// ════════════════════════════════════════════════════════════════════════════
// 1. AES-256-GCM ENCRYPTION / DECRYPTION
// ════════════════════════════════════════════════════════════════════════════
describe('encryptSecret / decryptSecret', () => {
  it('returns a string in iv:authTag:ciphertext format', () => {
    const encrypted = encryptSecret('my-totp-secret');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    // iv = 12 bytes → 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // authTag = 16 bytes → 32 hex chars
    expect(parts[1]).toHaveLength(32);
  });

  it('round-trips correctly', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptSecret(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const a = encryptSecret('same-secret');
    const b = encryptSecret('same-secret');
    expect(a).not.toBe(b);
  });

  it('decryptSecret throws for invalid format', () => {
    expect(() => decryptSecret('onlyonepart')).toThrow();
  });

  it('decryptSecret throws for tampered authTag', () => {
    const enc = encryptSecret('hello');
    const [iv, , ct] = enc.split(':');
    // Replace authTag with zeros
    const tampered = `${iv}:${'0'.repeat(32)}:${ct}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('handles empty string', () => {
    const enc = encryptSecret('');
    expect(decryptSecret(enc)).toBe('');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. TOTP SECRET GENERATION
// ════════════════════════════════════════════════════════════════════════════
describe('generateTOTPSecret', () => {
  it('calls authenticator.generateSecret and returns the value', () => {
    expect(generateTOTPSecret()).toBe('JBSWY3DPEHPK3PXP');
    expect(authenticator.generateSecret).toHaveBeenCalled();
  });
});

describe('generateEncryptedTOTPSecret', () => {
  it('returns secret and an encrypted version', () => {
    const { secret, encryptedSecret } = generateEncryptedTOTPSecret();
    expect(secret).toBe('JBSWY3DPEHPK3PXP');
    // encrypted is NOT the raw secret
    expect(encryptedSecret).not.toBe(secret);
    // And it round-trips
    expect(decryptSecret(encryptedSecret)).toBe(secret);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. TOTP URI GENERATION
// ════════════════════════════════════════════════════════════════════════════
describe('generateTOTPUri', () => {
  it('builds the expected otpauth URI', () => {
    const uri = generateTOTPUri('JBSWY3DPEHPK3PXP', 'alice@example.com');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('alice@example.com');
    expect(uri).toContain('JBSWY3DPEHPK3PXP');
  });

  it('uses FairArena as the default issuer', () => {
    generateTOTPUri('SECRET', 'user@example.com');
    expect(authenticator.keyuri).toHaveBeenCalledWith('user@example.com', 'FairArena', 'SECRET');
  });

  it('accepts a custom issuer', () => {
    generateTOTPUri('SECRET', 'user@acme.com', 'ACME Corp');
    expect(authenticator.keyuri).toHaveBeenCalledWith('user@acme.com', 'ACME Corp', 'SECRET');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. verifyTOTPCode
// ════════════════════════════════════════════════════════════════════════════
describe('verifyTOTPCode', () => {
  beforeEach(() => {
    vi.mocked(authenticator.verify).mockReset();
  });

  it('returns true when authenticator.verify returns true', () => {
    vi.mocked(authenticator.verify).mockReturnValueOnce(true);
    const { encryptedSecret } = generateEncryptedTOTPSecret();
    expect(verifyTOTPCode('123456', encryptedSecret)).toBe(true);
  });

  it('returns false when authenticator.verify returns false', () => {
    vi.mocked(authenticator.verify).mockReturnValueOnce(false);
    const { encryptedSecret } = generateEncryptedTOTPSecret();
    expect(verifyTOTPCode('000000', encryptedSecret)).toBe(false);
  });

  it('returns false when decryptSecret throws (corrupted secret)', () => {
    expect(verifyTOTPCode('123456', 'invalid-garbage')).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. BACKUP CODES
// ════════════════════════════════════════════════════════════════════════════
describe('generateBackupCodes', () => {
  it('generates the requested number of codes', () => {
    expect(generateBackupCodes(10)).toHaveLength(10);
    expect(generateBackupCodes(5)).toHaveLength(5);
  });

  it('defaults to 10 codes', () => {
    expect(generateBackupCodes()).toHaveLength(10);
  });

  it('each code is exactly 10 characters', () => {
    for (const code of generateBackupCodes()) {
      expect(code).toHaveLength(10);
    }
  });

  it('uses only the diceware-safe character set (no I, O, 0, 1)', () => {
    const all = generateBackupCodes(50).join('');
    expect(all).not.toMatch(/[IO01]/);
  });

  it('generates unique codes (extremely low collision probability)', () => {
    const codes = generateBackupCodes(10);
    const unique = new Set(codes);
    expect(unique.size).toBe(10);
  });
});

describe('hashBackupCodes', () => {
  it('returns SHA-256 hex digests (64 chars each)', () => {
    const codes = ['ABCDEFGHIJ', 'KLMNPQRSTU'];
    const hashes = hashBackupCodes(codes);
    expect(hashes).toHaveLength(2);
    for (const h of hashes) {
      expect(h).toHaveLength(64);
      expect(h).toMatch(/^[0-9a-f]+$/);
    }
  });

  it('same input always produces same hash', () => {
    const [h1] = hashBackupCodes(['ABCDEFGHIJ']);
    const [h2] = hashBackupCodes(['ABCDEFGHIJ']);
    expect(h1).toBe(h2);
  });

  it('different inputs produce different hashes', () => {
    const [h1] = hashBackupCodes(['AAAAAAAAAA']);
    const [h2] = hashBackupCodes(['BBBBBBBBBB']);
    expect(h1).not.toBe(h2);
  });
});

describe('verifyBackupCode', () => {
  const codes = ['ABCDEFGHIJ', 'KLMNPQRSTU', 'VWXYZ23456'];
  let hashedCodes: string[];

  beforeEach(() => {
    hashedCodes = hashBackupCodes(codes);
  });

  it('returns the correct index for a matching code', () => {
    expect(verifyBackupCode('ABCDEFGHIJ', hashedCodes)).toBe(0);
    expect(verifyBackupCode('KLMNPQRSTU', hashedCodes)).toBe(1);
    expect(verifyBackupCode('VWXYZ23456', hashedCodes)).toBe(2);
  });

  it('returns -1 for an unrecognised code', () => {
    expect(verifyBackupCode('WRONGCODE!', hashedCodes)).toBe(-1);
  });

  it('returns -1 for an already-removed (empty-set) list', () => {
    expect(verifyBackupCode('ABCDEFGHIJ', [])).toBe(-1);
  });
});

describe('formatBackupCode', () => {
  it('adds spaces every 4 characters', () => {
    expect(formatBackupCode('ABCDEFGHIJ')).toBe('ABCD EFGH IJ');
  });

  it('trims trailing space when code length is divisible by 4', () => {
    expect(formatBackupCode('ABCDEFGH')).toBe('ABCD EFGH');
  });

  it('handles 4-char code', () => {
    expect(formatBackupCode('ABCD')).toBe('ABCD');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. generateMFASetup (integration)
// ════════════════════════════════════════════════════════════════════════════
describe('generateMFASetup', () => {
  it('returns all required fields', async () => {
    vi.mocked(authenticator.verify).mockReturnValue(true);
    const setup = await generateMFASetup('alice@example.com');

    expect(setup).toHaveProperty('secret');
    expect(setup).toHaveProperty('encryptedSecret');
    expect(setup).toHaveProperty('qrCode');
    expect(setup).toHaveProperty('backupCodes');
    expect(setup).toHaveProperty('hashedBackupCodes');
  });

  it('qrCode is a data URL', async () => {
    const setup = await generateMFASetup('alice@example.com');
    expect(setup.qrCode).toMatch(/^data:image\/png;base64,/);
  });

  it('backupCodes are formatted (contain spaces)', async () => {
    const setup = await generateMFASetup('alice@example.com');
    for (const code of setup.backupCodes) {
      // Formatted codes like "ABCD EFGH IJ" contain at least one space
      expect(code).toContain(' ');
    }
  });

  it('hashedBackupCodes has the same length as backupCodes', async () => {
    const setup = await generateMFASetup('alice@example.com');
    expect(setup.hashedBackupCodes).toHaveLength(setup.backupCodes.length);
  });

  it('encryptedSecret round-trips to secret', async () => {
    const setup = await generateMFASetup('alice@example.com');
    expect(decryptSecret(setup.encryptedSecret)).toBe(setup.secret);
  });
});
