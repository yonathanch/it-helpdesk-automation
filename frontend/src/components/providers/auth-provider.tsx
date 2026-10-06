'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import * as authService from '@/lib/services/auth.service';
import { tokenStore } from '@/lib/token-store';
import { isAdmin, isStaff } from '@/lib/labels';
import type { Role, SessionUser } from '@/lib/types';

interface AuthContextValue {
  user: SessionUser | null;
  /** true saat status sesi masih dicek dari storage/server */
  initializing: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    department?: string;
  }) => Promise<SessionUser>;
  logout: () => void;
  /** Helper role untuk menyesuaikan kontrol UI (otorisasi tetap ditegakkan backend). */
  can: {
    staff: boolean;
    admin: boolean;
    has: (role: Role) => boolean;
  };
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [initializing, setInitializing] = React.useState(true);

  // Saat load pertama: pulihkan user dari storage lalu validasi ke /auth/me.
  React.useEffect(() => {
    let cancelled = false;

    async function restore() {
      const stored = tokenStore.getUser();
      if (!stored || !tokenStore.getAccessToken()) {
        if (!cancelled) setInitializing(false);
        return;
      }

      try {
        const fresh = await authService.me();
        if (cancelled) return;
        setUser({
          id: fresh.id,
          name: fresh.name,
          email: fresh.email,
          role: fresh.role,
          department: fresh.department,
        });
      } catch {
        // Token tidak valid / akun nonaktif — buang sesi lokal.
        tokenStore.clear();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sinkronkan dengan logout dari tab lain (mis. setelah refresh token gagal).
  React.useEffect(
    () => tokenStore.subscribe(() => setUser(tokenStore.getUser())),
    [],
  );

  const login = React.useCallback(async (email: string, password: string) => {
    const auth = await authService.login(email, password);
    tokenStore.set(auth);
    setUser(auth.user);
    return auth.user;
  }, []);

  const register = React.useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      department?: string;
    }) => {
      const auth = await authService.register(input);
      tokenStore.set(auth);
      setUser(auth.user);
      return auth.user;
    },
    [],
  );

  const logout = React.useCallback(() => {
    authService.logout();
    setUser(null);
    router.replace('/login');
  }, [router]);

  const role = user?.role ?? null;

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      login,
      register,
      logout,
      can: {
        staff: role ? isStaff(role) : false,
        admin: role ? isAdmin(role) : false,
        has: (candidate: Role) => role === candidate,
      },
    }),
    [user, initializing, login, register, logout, role],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  }
  return context;
}
