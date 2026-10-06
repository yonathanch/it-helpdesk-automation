'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { useAuth } from '@/components/providers/auth-provider';
import { Spinner } from '@/components/ui/states';
import { homeForRole } from '@/lib/navigation';

/**
 * RequireAuth mengarahkan ke `/login?next=<path>` saat sesi belum ada.
 * Hanya path internal yang boleh dipakai supaya parameter ini tidak bisa
 * dipakai sebagai open redirect ke situs lain.
 */
function safeNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, initializing } = useAuth();
  const next = safeNext(searchParams.get('next'));

  // Sudah login? Jangan tampilkan form lagi.
  React.useEffect(() => {
    if (user) router.replace(next ?? homeForRole(user.role));
  }, [user, next, router]);

  if (initializing) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Memeriksa sesi…" />
      </div>
    );
  }

  return <LoginForm next={next} />;
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner label="Memuat halaman masuk…" />
        </div>
      }
    >
      <LoginPageInner />
    </React.Suspense>
  );
}
