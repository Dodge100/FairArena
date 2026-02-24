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

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { OAUTH_PROVIDERS, initiateOAuthLogin, type OAuthProvider } from '../config/oauth.providers';

const LAST_METHOD_STORAGE_KEY = 'lastUsedAuthMethod';

/**
 * Hook for managing OAuth login functionality
 */
export function useOAuthLogin(options?: { getRedirectPath?: () => string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  // Save last used login method
  const saveLastUsedMethod = useCallback((method: string) => {
    try {
      localStorage.setItem(LAST_METHOD_STORAGE_KEY, method);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Get last used login method
  const getLastUsedMethod = useCallback((): string | null => {
    try {
      return localStorage.getItem(LAST_METHOD_STORAGE_KEY);
    } catch {
      return null;
    }
  }, []);

  // Generic OAuth login handler
  const handleOAuthLogin = useCallback(
    async (providerId: string) => {
      if (isLoading) return;

      setIsLoading(true);
      setLoadingProvider(providerId);

      try {
        await initiateOAuthLogin(providerId, {
          redirectPath: options?.getRedirectPath?.(),
          saveLastMethod: saveLastUsedMethod,
          onError: (error) => {
            console.error(`${providerId} login error:`, error);
            toast.error(`Failed to initiate sign-in`);
          },
        });
      } catch {
        // Error already handled
      } finally {
        setIsLoading(false);
        setLoadingProvider(null);
      }
    },
    [isLoading, options, saveLastUsedMethod],
  );

  // Create individual provider handlers
  const handleGoogleLogin = useCallback(() => handleOAuthLogin('google'), [handleOAuthLogin]);
  const handleGithubLogin = useCallback(() => handleOAuthLogin('github'), [handleOAuthLogin]);
  const handleMicrosoftLogin = useCallback(() => handleOAuthLogin('microsoft'), [handleOAuthLogin]);
  const handleDiscordLogin = useCallback(() => handleOAuthLogin('discord'), [handleOAuthLogin]);
  const handleLinkedInLogin = useCallback(() => handleOAuthLogin('linkedin'), [handleOAuthLogin]);
  const handleSlackLogin = useCallback(() => handleOAuthLogin('slack'), [handleOAuthLogin]);
  const handleNotionLogin = useCallback(() => handleOAuthLogin('notion'), [handleOAuthLogin]);
  const handleXLogin = useCallback(() => handleOAuthLogin('x'), [handleOAuthLogin]);
  const handleZohoLogin = useCallback(() => handleOAuthLogin('zoho'), [handleOAuthLogin]);
  const handleLinearLogin = useCallback(() => handleOAuthLogin('linear'), [handleOAuthLogin]);
  const handleDropboxLogin = useCallback(() => handleOAuthLogin('dropbox'), [handleOAuthLogin]);
  const handleGitLabLogin = useCallback(() => handleOAuthLogin('gitlab'), [handleOAuthLogin]);
  const handleHuggingFaceLogin = useCallback(
    () => handleOAuthLogin('huggingface'),
    [handleOAuthLogin],
  );
  const handleVercelLogin = useCallback(() => handleOAuthLogin('vercel'), [handleOAuthLogin]);
  const handleFigmaLogin = useCallback(() => handleOAuthLogin('figma'), [handleOAuthLogin]);
  const handleZoomLogin = useCallback(() => handleOAuthLogin('zoom'), [handleOAuthLogin]);
  const handleAtlassianLogin = useCallback(() => handleOAuthLogin('atlassian'), [handleOAuthLogin]);

  // Check if a specific provider is loading
  const isProviderLoading = useCallback(
    (providerId: string) => {
      return loadingProvider === providerId;
    },
    [loadingProvider],
  );

  // Get all providers with their handlers
  const providers = useMemo(() => {
    return OAUTH_PROVIDERS.map((provider) => ({
      ...provider,
      handler: () => handleOAuthLogin(provider.id),
      isLoading: loadingProvider === provider.id,
    }));
  }, [handleOAuthLogin, loadingProvider]);

  return {
    // State
    isLoading,
    loadingProvider,

    // Generic handler
    handleOAuthLogin,

    // Individual handlers (for backward compatibility)
    handleGoogleLogin,
    handleGithubLogin,
    handleMicrosoftLogin,
    handleDiscordLogin,
    handleLinkedInLogin,
    handleSlackLogin,
    handleNotionLogin,
    handleXLogin,
    handleZohoLogin,
    handleLinearLogin,
    handleDropboxLogin,
    handleGitLabLogin,
    handleHuggingFaceLogin,
    handleVercelLogin,
    handleFigmaLogin,
    handleZoomLogin,
    handleAtlassianLogin,

    // Utilities
    isProviderLoading,
    saveLastUsedMethod,
    getLastUsedMethod,
    providers,
  };
}

export type { OAuthProvider };
