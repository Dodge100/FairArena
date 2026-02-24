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
 * authMethodFilter.test.ts
 *
 * Unit tests for getAuthMethodsForUser — covers super-secure mode
 * and regular mode with/without WebAuthn support.
 */
import { describe, expect, it } from 'vitest';
import { getAuthMethodsForUser } from '../../utils/authMethodFilter';

describe('getAuthMethodsForUser', () => {
  // ── Super Secure Mode ──────────────────────────────────────────────────────
  describe('superSecureEnabled = true', () => {
    describe('device supports WebAuthn', () => {
      const config = getAuthMethodsForUser(true, true);

      it('hides email/password auth', () => {
        expect(config.showEmailPassword).toBe(false);
      });
      it('shows Passkey', () => {
        expect(config.showPasskey).toBe(true);
      });
      it('shows OAuth', () => {
        expect(config.showOAuth).toBe(true);
      });
      it('shows SecurityKey MFA', () => {
        expect(config.showSecurityKeyMfa).toBe(true);
      });
      it('hides Email MFA', () => {
        expect(config.showEmailMfa).toBe(false);
      });
      it('hides Notification MFA', () => {
        expect(config.showNotificationMfa).toBe(false);
      });
      it('sets requiresWebAuthn = true', () => {
        expect(config.requiresWebAuthn).toBe(true);
      });
    });

    describe('device does NOT support WebAuthn', () => {
      const config = getAuthMethodsForUser(true, false);

      it('hides email/password', () => {
        expect(config.showEmailPassword).toBe(false);
      });
      it('hides Passkey (no WebAuthn support)', () => {
        expect(config.showPasskey).toBe(false);
      });
      it('shows OAuth', () => {
        expect(config.showOAuth).toBe(true);
      });
      it('hides SecurityKey MFA (no WebAuthn)', () => {
        expect(config.showSecurityKeyMfa).toBe(false);
      });
      it('sets requiresWebAuthn = true regardless', () => {
        expect(config.requiresWebAuthn).toBe(true);
      });
    });
  });

  // ── Normal Mode ───────────────────────────────────────────────────────────
  describe('superSecureEnabled = false', () => {
    describe('device supports WebAuthn', () => {
      const config = getAuthMethodsForUser(false, true);

      it('shows email/password', () => {
        expect(config.showEmailPassword).toBe(true);
      });
      it('shows Passkey', () => {
        expect(config.showPasskey).toBe(true);
      });
      it('shows OAuth', () => {
        expect(config.showOAuth).toBe(true);
      });
      it('shows SecurityKey MFA', () => {
        expect(config.showSecurityKeyMfa).toBe(true);
      });
      it('shows Email MFA', () => {
        expect(config.showEmailMfa).toBe(true);
      });
      it('shows Notification MFA', () => {
        expect(config.showNotificationMfa).toBe(true);
      });
      it('sets requiresWebAuthn = false', () => {
        expect(config.requiresWebAuthn).toBe(false);
      });
    });

    describe('device does NOT support WebAuthn', () => {
      const config = getAuthMethodsForUser(false, false);

      it('shows email/password', () => {
        expect(config.showEmailPassword).toBe(true);
      });
      it('hides Passkey (no WebAuthn)', () => {
        expect(config.showPasskey).toBe(false);
      });
      it('hides SecurityKey MFA (no WebAuthn)', () => {
        expect(config.showSecurityKeyMfa).toBe(false);
      });
      it('still shows Email and Notification MFA', () => {
        expect(config.showEmailMfa).toBe(true);
        expect(config.showNotificationMfa).toBe(true);
      });
      it('sets requiresWebAuthn = false', () => {
        expect(config.requiresWebAuthn).toBe(false);
      });
    });
  });
});
