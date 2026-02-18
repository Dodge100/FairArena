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

// Handler for IP blocking detection
let onIPBlocked: ((reasons?: string[]) => void) | null = null;

export function registerIPBlockHandler(handler: (reasons?: string[]) => void) {
  onIPBlocked = handler;
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
    ...((init.headers as any) || {}),
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

  // Check for ban status or IP blocking
  if (response.status === 403) {
    try {
      const clonedResponse = response.clone();
      const contentType = response.headers.get('content-type');

      // Check if response is HTML (IP blocking) or JSON (user ban)
      if (contentType?.includes('text/html')) {
        // IP blocked - extract reasons from HTML if possible
        const html = await clonedResponse.text();
        const reasons: string[] = [];

        // Try to extract reasons from HTML
        const reasonMatches = html.match(/<li>([^<]+)<\/li>/g);
        if (reasonMatches) {
          reasonMatches.forEach((match) => {
            const reason = match.replace(/<\/?li>/g, '').trim();
            if (reason && !reason.startsWith('→') && reason !== 'Suggestions:') {
              reasons.push(reason);
            }
          });
        }

        if (onIPBlocked) {
          onIPBlocked(
            reasons.length > 0
              ? reasons
              : ['Your IP has been blocked due to security policy violations'],
          );
        }
      } else {
        // Try to parse as JSON for user ban
        const body = await clonedResponse.json();
        if (body.code === 'USER_BANNED') {
          const reason =
            body.message?.replace('Your account has been suspended. Reason: ', '') || undefined;
          if (onUserBanned) {
            onUserBanned(reason);
          }
        } else if (body.code === 'IP_BLOCKED') {
          // Backend might also send JSON for IP blocks
          if (onIPBlocked) {
            onIPBlocked(
              body.reasons || ['Your IP has been blocked due to security policy violations'],
            );
          }
        }
      }
    } catch (e) {
      // Ignore parse errors on 403 checks
      console.warn('Failed to parse 403 response:', e);
    }
  }

  return response;
}

export async function publicApiFetch(input: RequestInfo, init: RequestInit = {}) {
  const method = init.method?.toUpperCase() || 'GET';
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  // Prepare headers
  const headers: Record<string, string> = {
    ...((init.headers as any) || {}),
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

  // Check for ban status or IP blocking
  if (response.status === 403) {
    try {
      const clonedResponse = response.clone();
      const contentType = response.headers.get('content-type');

      // Check if response is HTML (IP blocking) or JSON (user ban)
      if (contentType?.includes('text/html')) {
        // IP blocked - extract reasons from HTML if possible
        const html = await clonedResponse.text();
        const reasons: string[] = [];

        // Try to extract reasons from HTML
        const reasonMatches = html.match(/<li>([^<]+)<\/li>/g);
        if (reasonMatches) {
          reasonMatches.forEach((match) => {
            const reason = match.replace(/<\/?li>/g, '').trim();
            if (reason && !reason.startsWith('→') && reason !== 'Suggestions:') {
              reasons.push(reason);
            }
          });
        }

        if (onIPBlocked) {
          onIPBlocked(
            reasons.length > 0
              ? reasons
              : ['Your IP has been blocked due to security policy violations'],
          );
        }
      } else {
        // Try to parse as JSON for user ban/block
        const body = await clonedResponse.json();
        // Public API usually doesn't have user ban context, but might have IP block JSON
        if (body.code === 'IP_BLOCKED') {
          if (onIPBlocked) {
            onIPBlocked(
              body.reasons || ['Your IP has been blocked due to security policy violations'],
            );
          }
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
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


export async function publicApiRequest<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await publicApiFetch(input, init);

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
