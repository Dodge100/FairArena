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

import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * OAuth Provider Configuration
 */
export interface OAuthProvider {
  id: string;
  name: string;
  icon?: string;
  // If true, requires redirect path in URL
  supportsRedirect?: boolean;
}

/**
 * All supported OAuth providers
 */
export const OAUTH_PROVIDERS: OAuthProvider[] = [
  { id: 'google', name: 'Google' },
  { id: 'github', name: 'GitHub' },
  { id: 'microsoft', name: 'Microsoft' },
  { id: 'discord', name: 'Discord' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'slack', name: 'Slack' },
  { id: 'notion', name: 'Notion' },
  { id: 'x', name: 'X', supportsRedirect: true },
  { id: 'zoho', name: 'Zoho', supportsRedirect: true },
  { id: 'linear', name: 'Linear', supportsRedirect: true },
  { id: 'dropbox', name: 'Dropbox', supportsRedirect: true },
  { id: 'gitlab', name: 'GitLab' },
  { id: 'huggingface', name: 'Hugging Face' },
  { id: 'vercel', name: 'Vercel', supportsRedirect: true },
  { id: 'figma', name: 'Figma', supportsRedirect: true },
  { id: 'zoom', name: 'Zoom', supportsRedirect: true },
  { id: 'atlassian', name: 'Atlassian', supportsRedirect: true },
];

/**
 * Get OAuth provider by ID
 */
export function getOAuthProvider(id: string): OAuthProvider | undefined {
  return OAUTH_PROVIDERS.find((p) => p.id === id);
}

/**
 * Get OAuth URL for a provider
 */
export function getOAuthUrl(
  providerId: string,
  options?: {
    redirectPath?: string;
    preserveFlow?: boolean;
  },
): string {
  const provider = getOAuthProvider(providerId);
  if (!provider) {
    throw new Error(`Unknown OAuth provider: ${providerId}`);
  }

  const baseUrl = `${API_BASE_URL}/api/v1/auth/${providerId}`;

  // Build redirect path with optional flow preservation
  let finalRedirect = options?.redirectPath || '/dashboard';

  // Preserve add_account flow if needed
  if (options?.preserveFlow) {
    const params = new URLSearchParams(window.location.search);
    const flow = params.get('flow') || sessionStorage.getItem('auth_flow');
    const oauthRequest = params.get('oauth_request') || sessionStorage.getItem('oauth_request_id');

    // Add flow parameter
    if (flow === 'add_account') {
      finalRedirect = finalRedirect.includes('?')
        ? `${finalRedirect}&flow=add_account`
        : `${finalRedirect}?flow=add_account`;
    }

    // Add oauth_request parameter (for OAuth consent flow)
    if (oauthRequest) {
      finalRedirect = finalRedirect.includes('?')
        ? `${finalRedirect}&oauth_request=${oauthRequest}`
        : `${finalRedirect}?oauth_request=${oauthRequest}`;
    }
  }

  return `${baseUrl}?redirect=${encodeURIComponent(finalRedirect)}`;
}

/**
 * Initiate OAuth login for a provider
 */
export async function initiateOAuthLogin(
  providerId: string,
  options?: {
    redirectPath?: string;
    preserveFlow?: boolean;
    onStart?: () => void;
    onError?: (error: Error) => void;
    saveLastMethod?: (method: string) => void;
  },
): Promise<void> {
  const { redirectPath, preserveFlow = true, onStart, onError, saveLastMethod } = options || {};

  try {
    // Save last used method if provided
    if (saveLastMethod) {
      saveLastMethod(providerId);
    }

    // Call start callback
    if (onStart) {
      onStart();
    }

    // Get the OAuth URL with flow preservation
    const url = getOAuthUrl(providerId, { redirectPath, preserveFlow });
    const response = await fetch(url);
    const result = await response.json();

    if (result.success && result.data?.url) {
      // Redirect to OAuth provider
      window.location.href = result.data.url;
    } else {
      throw new Error(
        result.message || `Failed to get ${getOAuthProvider(providerId)?.name} sign-in URL`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'OAuth login failed';

    if (onError) {
      onError(error instanceof Error ? error : new Error(errorMessage));
    } else {
      toast.error(errorMessage);
    }

    throw error;
  }
}

/**
 * Create an OAuth login handler for a specific provider
 */
export function createOAuthLoginHandler(
  providerId: string,
  setIsLoading: (loading: boolean) => void,
  saveLastMethod?: (method: string) => void,
  getRedirectPath?: () => string,
) {
  return async () => {
    try {
      await initiateOAuthLogin(providerId, {
        redirectPath: getRedirectPath?.(),
        onStart: () => setIsLoading(true),
        saveLastMethod,
        onError: (error) => {
          console.error(`${providerId} login error:`, error);
          toast.error(`Failed to initiate ${getOAuthProvider(providerId)?.name} sign-in`);
          setIsLoading(false);
        },
      });
    } catch {
      setIsLoading(false);
    }
  };
}
