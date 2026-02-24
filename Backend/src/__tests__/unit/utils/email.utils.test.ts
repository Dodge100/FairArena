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
 * email.utils.test.ts
 *
 * Tests for the email normalization utility, covering Gmail dot-removal,
 * subaddress stripping, Googlemail alias, and generic domain lowercasing.
 */
import { describe, expect, it } from 'vitest';
import { normalizeEmail } from '../../../utils/email.utils.js';

describe('normalizeEmail', () => {
  // ── Gmail normalization ───────────────────────────────────────────────────
  describe('Gmail (gmail.com)', () => {
    it('lowercases the email', () => {
      expect(normalizeEmail('USER@GMAIL.COM')).toBe('user@gmail.com');
    });

    it('removes dots from local part', () => {
      expect(normalizeEmail('john.doe@gmail.com')).toBe('johndoe@gmail.com');
    });

    it('strips subaddress (after +)', () => {
      expect(normalizeEmail('john+newsletter@gmail.com')).toBe('john@gmail.com');
    });

    it('removes dots AND strips subaddress together', () => {
      expect(normalizeEmail('j.o.h.n+spam@gmail.com')).toBe('john@gmail.com');
    });

    it('handles already-canonical Gmail', () => {
      expect(normalizeEmail('johndoe@gmail.com')).toBe('johndoe@gmail.com');
    });
  });

  // ── Googlemail alias ──────────────────────────────────────────────────────
  describe('Googlemail (googlemail.com)', () => {
    it('applies same normalization as gmail.com', () => {
      expect(normalizeEmail('john.doe+test@googlemail.com')).toBe('johndoe@googlemail.com');
    });
  });

  // ── Generic domains ───────────────────────────────────────────────────────
  describe('Generic domains', () => {
    it('lowercases the entire address', () => {
      expect(normalizeEmail('JOHN.DOE@EXAMPLE.COM')).toBe('john.doe@example.com');
    });

    it('trims whitespace', () => {
      expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
    });

    it('preserves dots in local part for non-Gmail domains', () => {
      expect(normalizeEmail('john.doe@company.org')).toBe('john.doe@company.org');
    });

    it('preserves subaddresses for non-Gmail domains', () => {
      expect(normalizeEmail('user+tag@yahoo.com')).toBe('user+tag@yahoo.com');
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────
  describe('Edge cases', () => {
    it('returns original (lowercased) for emails without @', () => {
      const result = normalizeEmail('notanemail');
      expect(result).toBe('notanemail');
    });

    it('handles multiple @ signs gracefully (takes first part)', () => {
      // lowercaseEmail.split('@') gives ['a', 'b', 'c']
      const result = normalizeEmail('a@b@c.com');
      expect(result).toBe('a@b@c.com'); // Just lowercased
    });

    it('handles an empty string', () => {
      expect(normalizeEmail('')).toBe('');
    });
  });

  // ── Identity equivalence ──────────────────────────────────────────────────
  describe('Equivalent Gmail addresses resolve to the same canonical form', () => {
    const variants = [
      'johndoe@gmail.com',
      'john.doe@gmail.com',
      'J.O.H.N.D.O.E@gmail.com',
      'johndoe+spam@gmail.com',
      'j.o.h.n.d.o.e+anything@gmail.com',
    ];

    it('all Gmail variants map to the same canonical form', () => {
      const canonical = variants.map(normalizeEmail);
      expect(new Set(canonical).size).toBe(1);
      expect(canonical[0]).toBe('johndoe@gmail.com');
    });
  });
});
