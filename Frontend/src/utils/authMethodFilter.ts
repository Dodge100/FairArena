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
