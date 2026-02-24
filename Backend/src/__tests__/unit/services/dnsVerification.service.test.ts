/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 */

import dns from 'dns/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createVerificationRecord,
  generateVerificationToken,
  verifyDomainOwnership,
} from '../../../services/dnsVerification.service.js';

vi.mock('dns/promises', () => ({
  default: {
    resolveTxt: vi.fn(),
  },
}));

vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn().mockReturnValue('mock-cuid'),
}));

describe('DNS Verification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a verification token', () => {
    expect(generateVerificationToken()).toBe('mock-cuid');
  });

  it('creates a verification record string', () => {
    expect(createVerificationRecord('abc-123')).toBe('fairarena-verify=abc-123');
  });

  describe('verifyDomainOwnership', () => {
    const domain = 'example.com';
    const token = 'tok-123';
    const expectedRecord = 'fairarena-verify=tok-123';

    it('returns verified=true when the correct record is found', async () => {
      (dns.resolveTxt as any).mockResolvedValueOnce([[expectedRecord]]);

      const result = await verifyDomainOwnership(domain, token);

      expect(result.verified).toBe(true);
      expect(result.record).toBe(expectedRecord);
      expect(dns.resolveTxt).toHaveBeenCalledWith(`_fairarena-verify.${domain}`);
    });

    it('returns verified=false when records exist but do not match', async () => {
      (dns.resolveTxt as any).mockResolvedValueOnce([['fairarena-verify=wrong-token']]);

      const result = await verifyDomainOwnership(domain, token);

      expect(result.verified).toBe(false);
      expect(result.record).toBeUndefined();
    });

    it('returns verified=false and descriptive error for ENODATA', async () => {
      const error = new Error('No data');
      (error as any).code = 'ENODATA';
      (dns.resolveTxt as any).mockRejectedValueOnce(error);

      const result = await verifyDomainOwnership(domain, token);

      expect(result.verified).toBe(false);
      expect(result.error).toContain('DNS record not found');
    });

    it('handles timeout errors', async () => {
      const error = new Error('Timeout');
      (error as any).code = 'ETIMEOUT';
      (dns.resolveTxt as any).mockRejectedValueOnce(error);

      const result = await verifyDomainOwnership(domain, token);

      expect(result.verified).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('handles generic errors', async () => {
      (dns.resolveTxt as any).mockRejectedValueOnce(new Error('Unknown'));

      const result = await verifyDomainOwnership(domain, token);

      expect(result.verified).toBe(false);
      expect(result.error).toContain('failed');
    });
  });
});
