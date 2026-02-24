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

import { publicApiFetch } from '@/lib/apiClient';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * Hook to check if passkeys are supported
 */
export function usePasskeySupport() {
  const [isSupported, setIsSupported] = useState(() => browserSupportsWebAuthn());

  useEffect(() => {
    // Re-check just in case, though once is usually enough
    setIsSupported(browserSupportsWebAuthn());
  }, []);

  return isSupported;
}

/**
 * Hook to handle passkey login flow
 */
export function usePasskeyLogin() {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  return useMutation({
    mutationFn: async (email?: string) => {
      // Step 1: Get authentication options
      const optionsRes = await publicApiFetch(`${apiUrl}/api/v1/passkeys/login/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const optionsData = await optionsRes.json();

      if (!optionsData.success) {
        throw new Error(optionsData.message || 'Failed to get authentication options');
      }

      // Step 2: Authenticate with browser
      const credential = await startAuthentication({
        optionsJSON: optionsData.data,
      });

      // Step 3: Verify with server
      const verifyRes = await publicApiFetch(`${apiUrl}/api/v1/passkeys/login/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: credential }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.success) {
        throw new Error(verifyData.message || 'Failed to verify authentication');
      }

      return {
        user: verifyData.data.user,
        accessToken: verifyData.data.accessToken,
      };
    },
  });
}

/**
 * Helper to handle passkey login flow (non-hook version)
 */
export async function initiatePasskeyLogin(apiUrl: string, email?: string) {
  try {
    // Step 1: Get authentication options
    const optionsRes = await publicApiFetch(`${apiUrl}/api/v1/passkeys/login/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const optionsData = await optionsRes.json();

    if (!optionsData.success) {
      return {
        success: false,
        error: optionsData.message || 'Failed to get authentication options',
      };
    }

    // Step 2: Authenticate with browser
    const credential = await startAuthentication({
      optionsJSON: optionsData.data,
    });

    // Step 3: Verify with server
    const verifyRes = await publicApiFetch(`${apiUrl}/api/v1/passkeys/login/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: credential }),
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      return { success: false, error: verifyData.message || 'Failed to verify authentication' };
    }

    return {
      success: true,
      user: verifyData.data.user,
      accessToken: verifyData.data.accessToken,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Passkey authentication failed';
    if (
      message.includes('cancelled') ||
      message.includes('canceled') ||
      message.includes('AbortError')
    ) {
      return { success: false, error: 'cancelled' };
    }
    return { success: false, error: message };
  }
}
