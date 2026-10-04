'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Spinner, EmptyState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { homeForRole } from '@/lib/navigation';
import { ROLE_LABEL } from '@/lib/labels';
import type { Role } from '@/lib/types';

/**
 * Guard sisi klien.
 *
 * CATATAN: ini hanya untuk UX (menghindari kilat konten). Otorisasi
 * sesungguhnya tetap ditegakkan backend lewat JwtAuthGuard + RolesGuard,
 * sehingga menyalin URL halaman terlarang tidak memberi akses data.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, initializing } = useAuth();

  React.useEffect(() => {
    if (!initializing && !user) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
    }
  }, [initializing, user, pathname, router]);

  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner label="Memuat sesi Anda…" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Mengalihkan ke halaman masuk…" />
      </div>
    );
  }

  return <>{children}</>;
}

/** Pastikan pengguna punya salah satu dari role yang diizinkan. */
export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, initializing } = useAuth();

  const allowed = user ? roles.includes(user.role) : false;

  React.useEffect(() => {
    if (!initializing && user && !allowed) {
      router.replace(homeForRole(user.role));
    }
  }, [initializing, user, allowed, router]);

  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner label="Memeriksa hak akses…" />
      </div>
    );
  }

  if (!user) return null;

  if (!allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <EmptyState
          title="Akses tidak tersedia"
          description={`Halaman ini hanya untuk: ${roles
            .map((role) => ROLE_LABEL[role])
            .join(', ')}. Akun Anda terdaftar sebagai ${ROLE_LABEL[user.role]}.`}
          action={
            <Button onClick={() => router.replace(homeForRole(user.role))}>
              Kembali ke beranda
            </Button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
