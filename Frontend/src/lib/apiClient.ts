// lib/apiClient.ts
let getTokenFn: (() => Promise<string | null>) | null = null;

export function registerAuth(getToken: () => Promise<string | null>) {
  getTokenFn = getToken;
}

export async function apiFetch(input: RequestInfo, init: RequestInit = {}) {
  if (!getTokenFn) {
    throw new Error('Auth not initialized');
  }

  const token = await getTokenFn();

  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: token ? `Bearer ${token}` : '',
    },
    credentials: 'include',
  });
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
