import { api } from '@/lib/api';
import type {
  AiDraftResult,
  Attachment,
  Paginated,
  Ticket,
  TicketDetail,
  TicketListQuery,
  TicketMessage,
  TicketPriority,
  TicketStatus,
} from '@/lib/types';

/**
 * Service tiket — cerminan TicketsController (backend/src/tickets).
 * Query harus sesuai ListTicketsQueryDto (backend menolak field tak dikenal).
 */

export type CreateTicketInput = {
  title: string;
  description: string;
  categoryId: string;
  priority?: TicketPriority;
};

/** GET /tickets */
export function listTickets(query: TicketListQuery = {}) {
  return api.get<Paginated<Ticket>>('/tickets', { query: { ...query } });
}

/** GET /tickets/:id */
export function getTicket(id: string) {
  return api.get<TicketDetail>(`/tickets/${id}`);
}

/** POST /tickets — CreateTicketDto */
export function createTicket(input: CreateTicketInput) {
  const body: Record<string, string> = {
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
  };
  if (input.priority) body.priority = input.priority;
  return api.post<Ticket>('/tickets', body);
}

/** PATCH /tickets/:id/status — UpdateStatusDto */
export function updateStatus(id: string, status: TicketStatus) {
  return api.patch<Ticket>(`/tickets/${id}/status`, { status });
}

/** PATCH /tickets/:id/assign — AssignTicketDto */
export function assignTicket(id: string, assigneeId: string) {
  return api.patch<Ticket>(`/tickets/${id}/assign`, { assigneeId });
}

/** POST /tickets/:id/auto-assign (A-6) — AGENT/ADMIN */
export function autoAssign(id: string) {
  return api.post<Ticket>(`/tickets/${id}/auto-assign`);
}

/** POST /tickets/:id/messages — CreateMessageDto { content, isInternal? } */
export function addMessage(id: string, content: string, isInternal = false) {
  const body: Record<string, string | boolean> = { content };
  if (isInternal) body.isInternal = true;
  // Backend mengembalikan TicketDetail (termasuk messages terbaru).
  return api.post<TicketDetail>(`/tickets/${id}/messages`, body);
}

/** POST /tickets/:id/attachments — multipart field "file" */
export function uploadAttachment(id: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return api.upload<TicketDetail>(`/tickets/${id}/attachments`, form);
}

/** GET /tickets/:id/attachments */
export function listAttachments(id: string) {
  return api.get<Attachment[]>(`/tickets/${id}/attachments`);
}

// ------------------------- A-5: draft reply AI -------------------------

/** POST /tickets/:id/ai-draft — buat draf balasan (AGENT/ADMIN) */
export function generateDraft(id: string) {
  return api.post<AiDraftResult>(`/tickets/${id}/ai-draft`);
}

/**
 * POST /tickets/:id/ai-draft/approve — kirim draft atau konten hasil edit agen.
 * Backend mengembalikan objek TicketMessage yang baru dibuat.
 */
export function approveDraft(id: string, content?: string) {
  const body: Record<string, string> = {};
  if (content !== undefined && content.length > 0) body.content = content;
  return api.post<TicketMessage>(`/tickets/${id}/ai-draft/approve`, body);
}

/** DELETE /tickets/:id/ai-draft — buang draft */
export function discardDraft(id: string) {
  return api.delete<{ discarded: boolean }>(`/tickets/${id}/ai-draft`);
}
