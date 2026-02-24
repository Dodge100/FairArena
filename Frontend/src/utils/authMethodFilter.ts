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

export interface AuthMethodConfig {
  showEmailPassword: boolean;
  showPasskey: boolean;
  showOAuth: boolean;
  showSecurityKeyMfa: boolean;
  showEmailMfa: boolean;
  showNotificationMfa: boolean;
  requiresWebAuthn: boolean;
}

/**
 * Determines which authentication methods should be shown based on user's
 * security settings and device capabilities
 */
export function getAuthMethodsForUser(
  superSecureEnabled: boolean,
  deviceSupportsWebAuthn: boolean,
): AuthMethodConfig {
  // Super Secure Account: Only Passkey/OAuth + WebAuthn MFA
  if (superSecureEnabled) {
    return {
      showEmailPassword: false,
      showPasskey: deviceSupportsWebAuthn,
      showOAuth: true,
      showSecurityKeyMfa: deviceSupportsWebAuthn,
      showEmailMfa: false,
      showNotificationMfa: false,
      requiresWebAuthn: true,
    };
  }

  // Normal account: All methods available (if device supports)
  return {
    showEmailPassword: true,
    showPasskey: deviceSupportsWebAuthn,
    showOAuth: true,
    showSecurityKeyMfa: deviceSupportsWebAuthn,
    showEmailMfa: true,
    showNotificationMfa: true,
    requiresWebAuthn: false,
  };
}
