'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Inbox,
  LogOut,
  Settings,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { navForRole } from '@/lib/navigation';
import { ROLE_LABEL } from '@/lib/labels';
import { useAuth } from '@/components/providers/auth-provider';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ticket: Ticket,
  sparkles: Sparkles,
  inbox: Inbox,
  book: BookOpen,
  settings: Settings,
};

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = navForRole(user?.role ?? null);

  return (
    <nav aria-label="Navigasi utama" className="flex-1 space-y-0.5 px-3">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? Ticket;
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
              active
                ? 'bg-sidebar-accent font-medium text-sidebar-foreground'
                : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ProfileBlock({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-center gap-2.5">
        <UserAvatar name={user.name} size="sm" />
        {!compact ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-sidebar-muted">
              {ROLE_LABEL[user.role]}
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={logout}
          aria-label="Keluar"
          title="Keluar"
          className="rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Sidebar desktop. Navigasi mobile ditangani AppShell. */
export function AppSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          HD
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-sidebar-foreground">Help Desk</p>
          <p className="text-[11px] text-sidebar-muted">IT Support AI</p>
        </div>
      </div>

      <div className="py-3">
        <NavLinks />
      </div>

      <ProfileBlock />
    </aside>
  );
}

/** Konten sidebar untuk drawer mobile (tanpa wrapper aside). */
export function SidebarContent({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { user } = useAuth();
  const items = navForRole(user?.role ?? null);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          HD
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-sidebar-foreground">Help Desk</p>
          <p className="text-[11px] text-sidebar-muted">
            {user ? ROLE_LABEL[user.role] : 'IT Support AI'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <NavLinks onNavigate={onNavigate} />
      </div>

      <ProfileBlock />

      {items.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-sidebar-muted">
          Tidak ada menu untuk peran ini.
        </p>
      ) : null}
    </div>
  );
}
