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

import { apiRequest } from '@/lib/apiClient';
import { useQuery } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface GitHubLastUpdatedResponse {
  success: boolean;
  data: {
    lastUpdated: string;
    repoUrl: string;
    cached: boolean;
  };
}

export function useGitHubLastUpdated() {
  return useQuery({
    queryKey: ['github', 'last-updated'],
    queryFn: () => apiRequest<GitHubLastUpdatedResponse>(`${API_BASE}/api/v1/github/last-updated`),
    staleTime: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
    gcTime: 6 * 60 * 60 * 1000, // 6 hours cache time (formerly cacheTime)
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

export function formatLastUpdated(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  } catch {
    return 'Unknown';
  }
}
