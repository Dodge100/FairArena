// lib/apiClient.ts
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

  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: token ? `Bearer ${token}` : '',
    },
    credentials: 'include',
  });

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

export async function publicApiFetch(input: RequestInfo, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
    },
    credentials: 'include',
  });
}
