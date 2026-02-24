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

import { apiFetch } from './apiClient';

interface AxiosLikeResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestInit;
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
  get: async <T = unknown>(url: string, config?: RequestInit): Promise<AxiosLikeResponse<T>> => {
    const res = await apiFetch(url, { method: 'GET', ...config });
    if (!res.ok) {
      const errorResponse = await createAxiosLikeResponse(res);
      throw new AxiosLikeError('Request failed', errorResponse);
    }
    return createAxiosLikeResponse(res);
  },

  post: async <T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestInit,
  ): Promise<AxiosLikeResponse<T>> => {
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

  put: async <T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestInit,
  ): Promise<AxiosLikeResponse<T>> => {
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

  delete: async <T = unknown>(url: string, config?: RequestInit): Promise<AxiosLikeResponse<T>> => {
    const res = await apiFetch(url, { method: 'DELETE', ...config });
    if (!res.ok) {
      const errorResponse = await createAxiosLikeResponse(res);
      throw new AxiosLikeError('Request failed', errorResponse);
    }
    return createAxiosLikeResponse(res);
  },
};
