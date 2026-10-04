'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Spinner } from '@/components/ui/states';
import { homeForRole } from '@/lib/navigation';

export default function RootPage() {
  const router = useRouter();
  const { user, initializing } = useAuth();

  React.useEffect(() => {
    if (initializing) return;
    router.replace(user ? homeForRole(user.role) : '/login');
  }, [initializing, user, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Spinner label="Menyiapkan aplikasi…" />
    </div>
  );
}
