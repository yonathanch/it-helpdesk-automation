/**
 * API client terpusat.
 *
 * - Menempelkan `Authorization: Bearer <accessToken>` otomatis.
 * - Saat 401, mencoba refresh token SEKALI lalu mengulang request.
 * - Semua error dinormalisasi menjadi `ApiError`.
 *
 * Endpoint & bentuk payload harus mengikuti backend (backend/src/**\/*.controller.ts).
 */

import { ApiError, toApiError } from './api-error';
import { refreshSession, tokenStore } from './token-store';

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
export const API_BASE_URL = RAW_BASE.replace(/\/+$/, '');

type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Lewati auto-refresh (dipakai untuk request auth). */
  skipAuthRetry?: boolean;
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function send(path: string, options: RequestOptions, retry: boolean) {
  const { body, query, headers, skipAuthRetry, ...rest } = options;

  const finalHeaders = new Headers(headers);
  const token = tokenStore.getAccessToken();
  if (token) finalHeaders.set('Authorization', `Bearer ${token}`);

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    // Jangan set Content-Type manual — browser yang menambahkan boundary.
    payload = body;
  } else if (body !== undefined) {
    finalHeaders.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers: finalHeaders,
    body: payload,
  });

  if (response.status === 401 && !skipAuthRetry && !retry) {
    const refreshed = await refreshSession();
    if (refreshed) return send(path, options, true);
    // Refresh gagal → lepaskan sesi supaya UI mengarahkan ke login.
    tokenStore.clear();
  }

  if (!response.ok) throw await toApiError(response);

  if (response.status === 204) return undefined;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return response.json();
  return response.text();
}

export const api = {
  get<T>(path: string, options?: RequestOptions) {
    return send(path, { ...options, method: 'GET' }, false) as Promise<T>;
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return send(path, { ...options, method: 'POST', body }, false) as Promise<T>;
  },
  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return send(path, { ...options, method: 'PATCH', body }, false) as Promise<T>;
  },
  delete<T>(path: string, options?: RequestOptions) {
    return send(path, { ...options, method: 'DELETE' }, false) as Promise<T>;
  },
  /** Upload multipart (lampiran tiket). */
  upload<T>(path: string, form: FormData, options?: RequestOptions) {
    return send(path, { ...options, method: 'POST', body: form }, false) as Promise<T>;
  },
};

/** URL absolut untuk endpoint yang dipakai di tag <a>/<img> (butuh auth header manual). */
export function apiUrl(path: string, query?: Record<string, QueryValue>) {
  return buildUrl(path, query);
}

/** Unduh lampiran: fetch dengan header auth lalu picu save dialog. */
export async function downloadAttachment(id: string, filename: string) {
  const response = await fetch(`${API_BASE_URL}/attachments/${id}/download`, {
    headers: { Authorization: `Bearer ${tokenStore.getAccessToken() ?? ''}` },
  });
  if (!response.ok) throw await toApiError(response);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export { ApiError };
