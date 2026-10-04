'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Menu } from 'lucide-react';
import { navForRole } from '@/lib/navigation';
import { ROLE_LABEL } from '@/lib/labels';
import { useNotifications } from '@/components/providers/notifications-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';

/** Header aplikasi: pemicu drawer mobile, judul halaman, notifikasi, profil. */
export function AppHeader({ onOpenNav }: { onOpenNav: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();

  const current = navForRole(user?.role ?? null).find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Tutup dropdown saat klik di luar atau tekan Escape.
  React.useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Buka navigasi"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {current?.label ?? 'Help Desk'}
      </h2>

      <Link
        href="/notifications"
        aria-label={
          unreadCount > 0 ? `Notifikasi (${unreadCount} belum dibaca)` : 'Notifikasi'
        }
        className="relative rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Link>

      {user ? (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={cn(
              'flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-accent',
            )}
          >
            <UserAvatar name={user.name} size="sm" />
            <span className="hidden text-sm text-foreground sm:inline">
              {user.name}
            </span>
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-40 mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-md"
            >
              <div className="border-b border-border px-3 py-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {user.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {ROLE_LABEL[user.role]}
                </p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={logout}
                className="mt-1 w-full rounded-sm px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
              >
                Keluar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
