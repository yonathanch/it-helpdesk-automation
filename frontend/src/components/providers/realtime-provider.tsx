'use client';

import * as React from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  disconnectRealtime,
  onRealtime,
  type RealtimeEvent,
} from '@/lib/realtime';

interface RealtimeContextValue {
  /** true saat soket tersambung ke backend. */
  connected: boolean;
  /**
   * Berlangganan sebuah event realtime.
   * Mengembalikan fungsi berhenti berlangganan.
   */
  subscribe: (
    event: RealtimeEvent,
    listener: (payload: unknown) => void,
  ) => () => void;
}

const RealtimeContext = React.createContext<RealtimeContextValue>({
  connected: false,
  subscribe: () => () => undefined,
});

/**
 * Provider realtime.
 *
 * Satu-satunya tugasnya: membuka koneksi Socket.IO selama pengguna login,
 * lalu mengizinkan komponen berlangganan lewat `useRealtimeSubscription`.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    if (!user) {
      disconnectRealtime();
      setConnected(false);
      return;
    }

    // Membuka soket: hook pertama yang berlangganan akan lazily terhubung.
    const offConnected = onRealtime('connected', () => setConnected(true));
    const offUnauthorized = onRealtime('unauthorized', () => setConnected(false));

    return () => {
      offConnected();
      offUnauthorized();
      setConnected(false);
    };
  }, [user]);

  const value = React.useMemo<RealtimeContextValue>(
    () => ({ connected, subscribe: onRealtime }),
    [connected],
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

/**
 * Berlangganan satu event realtime selama komponen terpasang.
 * Bentuk yang paling sering dipakai halaman daftar & detail tiket.
 */
export function useRealtimeSubscription(
  event: RealtimeEvent,
  listener: (payload: unknown) => void,
) {
  const { subscribe } = React.useContext(RealtimeContext);

  // Efek disimpan di ref supaya komponen tidak berlangganan ulang tiap render.
  const listenerRef = React.useRef(listener);
  listenerRef.current = listener;

  React.useEffect(() => {
    return subscribe(event, (payload) => listenerRef.current(payload));
  }, [subscribe, event]);
}

/** Status koneksi realtime (untuk indikator di header). */
export function useRealtimeStatus(): boolean {
  return React.useContext(RealtimeContext).connected;
}