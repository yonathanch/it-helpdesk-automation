'use client';

import * as React from 'react';
import * as notificationsService from '@/lib/services/meta.service';
import { useAuth } from './auth-provider';
import { useRealtimeSubscription } from './realtime-provider';

interface NotificationsContextValue {
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = React.createContext<NotificationsContextValue | null>(
  null,
);

/** Interval polling notifikasi (ms). Cukup untuk lonceng header. */
const POLL_INTERVAL = 60_000;

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!user) return;
    try {
      const result = await notificationsService.unreadCount();
      setUnreadCount(result.count);
    } catch {
      // Notifikasi adalah informasi tambahan — gagalnya tidak boleh mengganggu UI.
    }
  }, [user]);

  React.useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    void refresh();
  }, [user, refresh]);

  // Polling saat tab terlihat agar angka tidak basi, dan hemat request.
  React.useEffect(() => {
    if (!user) return;
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void refresh();
      }
    };
    const timer = setInterval(tick, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [user, refresh]);

  // Realtime membuat angka lonceng langsung berubah — tanpa menunggu polling.
  useRealtimeSubscription('notification', () => {
    void refresh();
  });
  useRealtimeSubscription('ticket_created', () => {
    void refresh();
  });

  const markRead = React.useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        await notificationsService.markRead(id);
        await refresh();
      } finally {
        setLoading(false);
      }
    },
    [refresh],
  );

  const markAllRead = React.useCallback(async () => {
    setLoading(true);
    try {
      await notificationsService.markAllRead();
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const value = React.useMemo<NotificationsContextValue>(
    () => ({ unreadCount, loading, refresh, markRead, markAllRead }),
    [unreadCount, loading, refresh, markRead, markAllRead],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const context = React.useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      'useNotifications harus dipakai di dalam <NotificationsProvider>',
    );
  }
  return context;
}
