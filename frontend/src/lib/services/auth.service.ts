import { api } from '@/lib/api';
import { tokenStore } from '@/lib/token-store';
import type { AuthResponse, MeResponse } from '@/lib/types';

/** POST /auth/login — body persis LoginDto { email, password } */
export function login(email: string, password: string) {
  return api.post<AuthResponse>('/auth/login', { email, password }, {
    skipAuthRetry: true,
  });
}

/** POST /auth/register — body persis RegisterDto { name, email, password, department? } */
export function register(input: {
  name: string;
  email: string;
  password: string;
  department?: string;
}) {
  const body: Record<string, string> = {
    name: input.name,
    email: input.email,
    password: input.password,
  };
  if (input.department?.trim()) body.department = input.department.trim();

  return api.post<AuthResponse>('/auth/register', body, { skipAuthRetry: true });
}

/** GET /auth/me — data user terbaru dari server. */
export function me() {
  return api.get<MeResponse>('/auth/me');
}

/** Logout lokal: hapus token. Backend stateless, jadi tidak ada endpoint revoke. */
export function logout() {
  tokenStore.clear();
}
