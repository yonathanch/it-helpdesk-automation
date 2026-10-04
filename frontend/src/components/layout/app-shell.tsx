'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { AppHeader } from './app-header';
import { AppSidebar, SidebarContent } from './app-sidebar';
import { Spinner } from '@/components/ui/states';
import { useAuth } from '@/components/providers/auth-provider';
import { homeForRole } from '@/lib/navigation';

/**
 * Shell aplikasi: sidebar (desktop) + header + drawer (mobile).
 * Menunggu sesi selesai dimuat agar tidak terjadi kedipan konten privat.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);

  // Tutup drawer setiap pindah halaman.
  React.useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Kunci scroll + fokus ke drawer saat terbuka di mobile.
  React.useEffect(() => {
    if (!navOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [navOpen]);

  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner label="Memuat sesi Anda…" />
      </div>
    );
  }

  // Halaman di bawah layout aplikasi wajib login; guard asli ada di (app).
  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <AppSidebar />

      {navOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Tutup navigasi"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 bg-foreground/40"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigasi"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-64 shadow-xl outline-none"
          >
            <SidebarContent onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onOpenNav={() => setNavOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

export { homeForRole };
