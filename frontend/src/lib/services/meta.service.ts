import { api } from '@/lib/api';
import type { AppNotification, ChatResult, Sla } from '@/lib/types';

/** Service notifikasi — NotificationsController (backend/src/notifications). */

/** GET /notifications?unread=true — backend membatasi 50 item terbaru. */
export function listNotifications(unreadOnly = false) {
  return api.get<AppNotification[]>('/notifications', {
    query: unreadOnly ? { unread: 'true' } : undefined,
  });
}

/** GET /notifications/unread-count — { count: number } */
export function unreadCount() {
  return api.get<{ count: number }>('/notifications/unread-count');
}

/** PATCH /notifications/:id/read */
export function markRead(id: string) {
  return api.patch<AppNotification>(`/notifications/${id}/read`);
}

/** PATCH /notifications/read-all */
export function markAllRead() {
  return api.patch<{ updated: number }>('/notifications/read-all');
}

/** Service SLA — SlasController (backend/src/slas). */

export function listSlas() {
  return api.get<Sla[]>('/slas');
}

/** PATCH /slas/:id — ADMIN */
export function updateSla(
  id: string,
  input: {
    responseMinutes?: number;
    resolutionMinutes?: number;
    isActive?: boolean;
  },
) {
  const body: Record<string, number | boolean> = {};
  if (input.responseMinutes !== undefined) {
    body.responseMinutes = input.responseMinutes;
  }
  if (input.resolutionMinutes !== undefined) {
    body.resolutionMinutes = input.resolutionMinutes;
  }
  if (input.isActive !== undefined) body.isActive = input.isActive;
  return api.patch<Sla>(`/slas/${id}`, body);
}

/**
 * Service AI — ChatController (backend/src/ai).
 * Riwayat dibatasi maksimal 20 item oleh backend (ArrayMaxSize).
 */
const MAX_HISTORY = 20;

export function sendChat(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
) {
  return api.post<ChatResult>('/chat', {
    message,
    history: history.slice(-MAX_HISTORY),
  });
}
