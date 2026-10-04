'use client';

/**
 * Penyimpanan token di sisi klien.
 *
 * CATATAN KEAMANAN: backend memakai JWT stateless via header `Authorization:
 * Bearer` (tidak ada cookie httpOnly), jadi token harus disimpan di sisi
 * klien agar bisa dikirim. Access token disimpan di memory + sessionStorage
 * agar hilang saat tab ditutup; refresh token disimpan di localStorage
 * agar sesi bertahan antar-muat. Jangan pernah log nilai token.
 */

import type { AuthResponse, SessionUser } from './types';

const ACCESS_KEY = 'hd.accessToken';
const REFRESH_KEY = 'hd.refreshToken';
const USER_KEY = 'hd.user';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let currentUser: SessionUser | null = null;

const listeners = new Set<() => void>();

function readStorage() {
  if (typeof window === 'undefined') return;
  accessToken ??= window.sessionStorage.getItem(ACCESS_KEY);
  refreshToken ??= window.localStorage.getItem(REFRESH_KEY);
  if (!currentUser) {
    const raw = window.localStorage.getItem(USER_KEY);
    if (raw) {
      try {
        currentUser = JSON.parse(raw) as SessionUser;
      } catch {
        window.localStorage.removeItem(USER_KEY);
      }
    }
  }
}

/** Ambil token; lazily memuat dari storage saat pertama dipakai. */
function getAccessToken(): string | null {
  if (!accessToken && typeof window !== 'undefined') {
    readStorage();
  }
  return accessToken;
}

function getRefreshToken(): string | null {
  if (!refreshToken && typeof window !== 'undefined') {
    readStorage();
  }
  return refreshToken;
}

function persist(auth: AuthResponse) {
  accessToken = auth.accessToken;
  refreshToken = auth.refreshToken;
  currentUser = auth.user;

  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ACCESS_KEY, auth.accessToken);
  window.localStorage.setItem(REFRESH_KEY, auth.refreshToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
  notify();
}

export function clearAuth() {
  accessToken = null;
  refreshToken = null;
  currentUser = null;

  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem(USER_KEY);
  }
  notify();
}

function notify() {
  for (const listener of listeners) listener();
}

export const tokenStore = {
  getAccessToken,
  getRefreshToken,
  getUser(): SessionUser | null {
    if (!currentUser && typeof window !== 'undefined') readStorage();
    return currentUser;
  },
  set(auth: AuthResponse) {
    persist(auth);
  },
  clear: clearAuth,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/**
 * Refresh token dengan dati dari storage langsung (dipakai saat access token
 * sudah 401). Sengaja di luar tokenStore agar tidak memicu refresh berulang.
 */
export function readRefreshToken(): string | null {
  return getRefreshToken();
}

/**
 * Refresh tunggal yang dipakai apiFetch. Manyam request 401 agar tidak
 * menembak endpoint refresh berkali-kali.
 */
let refreshInFlight: Promise<boolean> | null = null;

export async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const token = readRefreshToken();
    if (!token) return false;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
      if (!response.ok) {
        clearAuth();
        return false;
      }
      const auth = (await response.json()) as AuthResponse;
      persist(auth);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
