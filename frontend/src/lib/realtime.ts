'use client';

import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/lib/api';
import { tokenStore } from '@/lib/token-store';

/**
 * Klien realtime (namespace `/realtime`).
 *
 * Backend mengautentikasi lewat `handshake.auth.token`, jadi token dikirim
 * saat koneksi — bukan sebagai query string (yang bisa bocor di log server).
 *
 * Koneksi bersifat Singleton per tab: banyak komponen bisa berlangganan event
 * tanpa membuka banyak soket.
 */

export type RealtimeEvent =
  | 'connected'
  | 'unauthorized'
  | 'ticket_created'
  | 'ticket_updated'
  | 'message'
  | 'notification';

type Listener = (payload: unknown) => void;

let socket: Socket | null = null;
const listeners = new Map<RealtimeEvent, Set<Listener>>();

function emitLocal(event: RealtimeEvent, payload: unknown) {
  listeners.get(event)?.forEach((listener) => {
    try {
      listener(payload);
    } catch {
      // Satu listener yang error tidak boleh memutus listener lain.
    }
  });
}

function ensureSocket(): Socket | null {
  const token = tokenStore.getAccessToken();
  if (!token) return null;

  if (socket && socket.connected) return socket;

  socket?.removeAllListeners();
  socket?.disconnect();

  socket = io(`${API_BASE_URL}/realtime`, {
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  for (const event of listeners.keys()) {
    socket.on(event, (payload: unknown) => emitLocal(event, payload));
  }
  socket.on('unauthorized', (payload: unknown) => emitLocal('unauthorized', payload));

  return socket;
}

/** Tutup koneksi (dipakai saat logout). */
export function disconnectRealtime() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  listeners.clear();
}

/** Berlangganan sebuah event. Mengembalikan fungsi unsubscribe. */
export function onRealtime(event: RealtimeEvent, listener: Listener): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(listener);

  const active = ensureSocket();
  if (active) active.on(event, (payload: unknown) => emitLocal(event, payload));

  return () => {
    listeners.get(event)?.delete(listener);
  };
}

/** Berlangganan room satu tiket (percakapan & perubahan status). */
export function subscribeTicket(ticketId: string): () => void {
  const active = ensureSocket();
  if (!active) return () => undefined;
  active.emit('subscribe', { ticketId });
  return () => {
    active.emit('unsubscribe', { ticketId });
  };
}

/** Status koneksi, untuk indikator "tersambung" di UI. */
export function isRealtimeConnected(): boolean {
  return Boolean(socket?.connected);
}