'use client';

import * as React from 'react';
import { AuthProvider } from '@/components/providers/auth-provider';
import { NotificationsProvider } from '@/components/providers/notifications-provider';

/** Pembungkus provider client untuk App Router (harus di file terpisah dari layout server). */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationsProvider>{children}</NotificationsProvider>
    </AuthProvider>
  );
}
