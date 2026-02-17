import { apiFetch } from './apiClient';

interface AxiosLikeResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
  config: any;
}

class AxiosLikeError extends Error {
  response?: AxiosLikeResponse;
  constructor(message: string, response?: AxiosLikeResponse) {
    super(message);
    this.response = response;
  }
}

const createAxiosLikeResponse = async (res: Response): Promise<AxiosLikeResponse> => {
  let data;
  try {
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text; // Fallback to text if not JSON
    }
  } catch {
    data = {};
  }

  // Convert Headers to object
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    data,
    status: res.status,
    statusText: res.statusText,
    headers,
    config: {},
  };
};

export const apiClient = {
  get: async <T = any>(url: string, config?: any): Promise<AxiosLikeResponse<T>> => {
    const res = await apiFetch(url, { method: 'GET', ...config });
    if (!res.ok) {
      const errorResponse = await createAxiosLikeResponse(res);
      throw new AxiosLikeError('Request failed', errorResponse);
    }
    return createAxiosLikeResponse(res);
  },

  post: async <T = any>(url: string, data?: any, config?: any): Promise<AxiosLikeResponse<T>> => {
    const res = await apiFetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json', ...config?.headers },
      ...config,
    });
    if (!res.ok) {
      const errorResponse = await createAxiosLikeResponse(res);
      throw new AxiosLikeError('Request failed', errorResponse);
    }
    return createAxiosLikeResponse(res);
  },

  put: async <T = any>(url: string, data?: any, config?: any): Promise<AxiosLikeResponse<T>> => {
    const res = await apiFetch(url, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json', ...config?.headers },
      ...config,
    });
    if (!res.ok) {
      const errorResponse = await createAxiosLikeResponse(res);
      throw new AxiosLikeError('Request failed', errorResponse);
    }
    return createAxiosLikeResponse(res);
  },

  delete: async <T = any>(url: string, config?: any): Promise<AxiosLikeResponse<T>> => {
    const res = await apiFetch(url, { method: 'DELETE', ...config });
    if (!res.ok) {
      const errorResponse = await createAxiosLikeResponse(res);
      throw new AxiosLikeError('Request failed', errorResponse);
    }
    return createAxiosLikeResponse(res);
  },
};
