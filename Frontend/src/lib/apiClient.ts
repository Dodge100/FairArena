// lib/apiClient.ts
import { getCsrfToken, setCsrfToken } from '../utils/csrfToken';

let getTokenFn: (() => Promise<string | null>) | null = null;

export function registerAuth(getToken: () => Promise<string | null>) {
  getTokenFn = getToken;
}

// Handler for banned user detection
let onUserBanned: ((reason?: string) => void) | null = null;

export function registerBanHandler(handler: (reason?: string) => void) {
  onUserBanned = handler;
}

export async function apiFetch(input: RequestInfo, init: RequestInit = {}) {
  if (!getTokenFn) {
    throw new Error('Auth not initialized');
  }

  const token = await getTokenFn();
  const method = init.method?.toUpperCase() || 'GET';
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  // Prepare headers
  const headers: Record<string, string> = {
    ...(init.headers as any || {}),
  };

  // Add authorization token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Add CSRF token for state-changing requests
  if (isStateChanging) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: 'include', // Important: include cookies for CSRF
  });

  // Capture CSRF token from response header
  const newCsrfToken = response.headers.get('X-CSRF-Token');
  if (newCsrfToken) {
    setCsrfToken(newCsrfToken);
  }

  // Check for ban status
  if (response.status === 403) {
    try {
      const clonedResponse = response.clone();
      const body = await clonedResponse.json();
      if (body.code === 'USER_BANNED') {
        const reason = body.message?.replace('Your account has been suspended. Reason: ', '') || undefined;
        if (onUserBanned) {
          onUserBanned(reason);
        }
      }
    } catch (e) {
      // Ignore JSON parse errors on 403 checks
    }
  }

  return response;
}

/**
 * Public API fetch for unauthenticated requests
 * Also handles CSRF tokens for public endpoints that require them
 */
export async function publicApiFetch(input: RequestInfo, init: RequestInit = {}) {
  const method = init.method?.toUpperCase() || 'GET';
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  // Prepare headers
  const headers: Record<string, string> = {
    ...(init.headers as any || {}),
  };

  // Add CSRF token for state-changing requests
  if (isStateChanging) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: 'include', // Important: include cookies for CSRF
  });

  // Capture CSRF token from response header
  const newCsrfToken = response.headers.get('X-CSRF-Token');
  if (newCsrfToken) {
    setCsrfToken(newCsrfToken);
  }

  return response;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, data: any) {
    super(`API Error: ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await apiFetch(input, init);

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }
    throw new ApiError(response.status, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
