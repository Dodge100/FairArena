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
 * csrfToken.test.ts
 *
 * Unit tests for the CSRF token module.
 * sessionStorage is stubbed in global setup.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCsrfToken,
  getCsrfToken,
  initializeCsrfToken,
  setCsrfToken,
} from '../../utils/csrfToken';

// Reset in-module state by re-importing after each test via utility
function resetModule() {
  // Call clearCsrfToken to wipe the module-level variable AND sessionStorage
  clearCsrfToken();
}

describe('CSRF Token Utility', () => {
  beforeEach(() => {
    resetModule();
    sessionStorage.clear();
  });

  // ── getCsrfToken ───────────────────────────────────────────────────────────
  describe('getCsrfToken', () => {
    it('returns null initially', () => {
      expect(getCsrfToken()).toBeNull();
    });
  });

  // ── setCsrfToken ───────────────────────────────────────────────────────────
  describe('setCsrfToken', () => {
    it('stores the token in memory', () => {
      setCsrfToken('tok-abc');
      expect(getCsrfToken()).toBe('tok-abc');
    });

    it('persists the token to sessionStorage', () => {
      setCsrfToken('tok-xyz');
      expect(sessionStorage.getItem('csrf-token')).toBe('tok-xyz');
    });

    it('overwrites the previous token', () => {
      setCsrfToken('first');
      setCsrfToken('second');
      expect(getCsrfToken()).toBe('second');
      expect(sessionStorage.getItem('csrf-token')).toBe('second');
    });
  });

  // ── initializeCsrfToken ────────────────────────────────────────────────────
  describe('initializeCsrfToken', () => {
    it('restores the token from sessionStorage', () => {
      sessionStorage.setItem('csrf-token', 'restored-token');
      initializeCsrfToken();
      expect(getCsrfToken()).toBe('restored-token');
    });

    it('does nothing when sessionStorage is empty', () => {
      initializeCsrfToken();
      expect(getCsrfToken()).toBeNull();
    });
  });

  // ── clearCsrfToken ─────────────────────────────────────────────────────────
  describe('clearCsrfToken', () => {
    it('sets in-memory token to null', () => {
      setCsrfToken('token');
      clearCsrfToken();
      expect(getCsrfToken()).toBeNull();
    });

    it('removes the token from sessionStorage', () => {
      setCsrfToken('token');
      clearCsrfToken();
      expect(sessionStorage.getItem('csrf-token')).toBeNull();
    });
  });

  // ── Order scenarios ────────────────────────────────────────────────────────
  describe('full lifecycle', () => {
    it('set → init stays intact if sessionStorage is in sync', () => {
      setCsrfToken('life-token');
      // Simulate page refresh: clear in-memory but keep sessionStorage
      // (we manually set the module variable to null via clearCsrfToken + re-seed)
      const stored = sessionStorage.getItem('csrf-token');
      // Re-init
      clearCsrfToken(); // wipes memory AND storage
      sessionStorage.setItem('csrf-token', stored!); // simulate storage surviving
      initializeCsrfToken();
      expect(getCsrfToken()).toBe('life-token');
    });

    it('clear removes both storage and memory', () => {
      setCsrfToken('full-cycle-token');
      clearCsrfToken();
      expect(getCsrfToken()).toBeNull();
      expect(sessionStorage.getItem('csrf-token')).toBeNull();
    });
  });
});
