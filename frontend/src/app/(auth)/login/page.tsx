'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { useAuth } from '@/components/providers/auth-provider';
import { Spinner } from '@/components/ui/states';
import { homeForRole } from '@/lib/navigation';

export default function LoginPage() {
  const router = useRouter();
  const { user, initializing } = useAuth();

  // Sudah login? Jangan tampilkan form lagi.
  React.useEffect(() => {
    if (user) router.replace(homeForRole(user.role));
  }, [user, router]);

  if (initializing) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Memeriksa sesi…" />
      </div>
    );
  }

  return <LoginForm />;
}
