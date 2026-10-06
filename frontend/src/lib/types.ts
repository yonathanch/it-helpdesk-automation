/**
 * Tipe domain — cerminan langsung dari Prisma schema & DTO backend.
 * Sumber: backend/prisma/schema.prisma dan DTO di backend/src.
 * Jangan menambah nilai enum yang tidak ada di backend.
 */

export const ROLES = ['ADMIN', 'AGENT', 'END_USER'] as const;
export type Role = (typeof ROLES)[number];

export const TICKET_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_USER',
  'RESOLVED',
  'CLOSED',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const NOTIFICATION_TYPES = [
  'TICKET_CREATED',
  'TICKET_ASSIGNED',
  'TICKET_STATUS_CHANGED',
  'SLA_BREACH',
  'GENERAL',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Transisi status yang diizinkan backend.
 *
 * WAJIB identik dengan `ALLOWED_TRANSITIONS` di
 * backend/src/tickets/tickets.service.ts. Kalau berbeda, UI akan menawarkan
 * perpindahan yang server tolak dengan 400.
 */
export const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'WAITING_USER', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'WAITING_USER', 'RESOLVED'],
  WAITING_USER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  // RESOLVED → IN_PROGRESS = reopen
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  // CLOSED bersifat final
  CLOSED: [],
};

// ========================= Users & Auth =========================

/** Dipakai sebagai payload JWT + user yang tersimpan di klien */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
}

/** Respons POST /auth/register|login|refresh */
export interface AuthResponse {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

/** Respons GET /auth/me (mengembalikan isActive & createdAt) */
export interface MeResponse extends SessionUser {
  isActive: boolean;
  createdAt: string;
}

// ========================= Users (admin) =========================

/** Data pengguna untuk halaman administrasi — tanpa passwordHash. */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Pilihan agen untuk penugasan tiket (GET /users/agents). */
export interface AgentOption {
  id: string;
  name: string;
  email: string;
  role: Extract<Role, 'ADMIN' | 'AGENT'>;
  /** Jumlah tiket belum selesai yang sedang ditangani. */
  activeTickets: number;
}

/** Query yang valid untuk GET /users (harus sesuai ListUsersQueryDto). */
export interface UserListQuery {
  page?: number;
  limit?: number;
  role?: Role;
  /** Dikirim sebagai string karena backend membacanya dari query string. */
  isActive?: 'true' | 'false';
  search?: string;
  sortBy?: 'name' | 'email' | 'createdAt' | 'role';
  sortOrder?: 'asc' | 'desc';
}

// ========================= Categories =========================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  _count?: { tickets: number };
}

/** Bentuk `category` di dalam Ticket — backend me-select hanya 3 field (TICKET_INCLUDE) */
export type TicketCategoryRef = Pick<Category, 'id' | 'name' | 'slug'>;

// ========================= SLAs =========================

export interface Sla {
  id: string;
  name: string;
  priority: TicketPriority;
  responseMinutes: number;
  resolutionMinutes: number;
  isActive: boolean;
}

// ========================= Tickets =========================

export interface TicketUserRef {
  id: string;
  name: string;
  email: string;
}

export interface Ticket {
  id: string;
  code: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  categoryId: string;
  category: TicketCategoryRef;
  requesterId: string;
  requester: TicketUserRef;
  assigneeId: string | null;
  assignee: TicketUserRef | null;
  slaDueAt: string | null;
  slaBreachedAt: string | null;
  firstReplyAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  aiTriaged: boolean;
  aiSentiment: string | null;
  aiConfidence: number | null;
  /** A-5: draf balasan AI yang tersimpan, belum dikirim */
  aiDraft: string | null;
  aiDraftAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  content: string;
  isInternal: boolean;
  ticketId: string;
  authorId: string;
  author: TicketUserRef & { role?: Role };
  isAiGenerated: boolean;
  /** Selalu dikirim backend (bisa kosong array). Opsional agar UI tahan data lama. */
  attachments?: Attachment[];
  createdAt: string;
}

/** Respons POST /tickets/:id/ai-draft (A-5) */
export interface AiDraftResult {
  draft: string;
  sources: Array<{
    id: string;
    title: string;
    slug: string;
    similarity: number;
    content: string;
  }>;
  generatedAt: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  /** Hanya ada pada lampiran yang sudah diunggah ke tiket (bukan di pesan) */
  messageId?: string | null;
  ticketId?: string | null;
}

export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
  attachments: Attachment[];
}

/** Bentuk list dari GET /tickets */
export interface TicketListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: TicketListMeta;
}

export type TicketScope = 'all' | 'mine' | 'unassigned';
export type TicketSortBy = 'createdAt' | 'updatedAt' | 'priority';

/** Query yang valid untuk GET /tickets (harus sesuai ListTicketsQueryDto) */
export interface TicketListQuery {
  page?: number;
  limit?: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: string;
  search?: string;
  scope?: TicketScope;
  sortBy?: TicketSortBy;
  sortOrder?: 'asc' | 'desc';
  /** Filter: tiket dibuat mulai tanggal (YYYY-MM-DD). Backend: ListTicketsQueryDto.dateFrom. */
  dateFrom?: string;
  /** Filter: tiket dibuat sampai tanggal (YYYY-MM-DD). Backend: ListTicketsQueryDto.dateTo. */
  dateTo?: string;
}

// ========================= Knowledge Base =========================

export interface KnowledgeArticle {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  embeddedAt: string | null;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string };
  category: { name: string; slug: string } | null;
}

export interface KnowledgeArticleDetail extends KnowledgeArticle {
  content: string;
}

export interface KnowledgeSearchHit {
  id: string;
  title: string;
  slug: string;
  content: string;
  similarity: number;
}

// ========================= Notifications =========================

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  ticketId: string | null;
  ticket: { id: string; code: string; title: string; status: TicketStatus; priority: TicketPriority } | null;
  createdAt: string;
}

// ========================= AI Chat (A-4) =========================

export interface ChatSource {
  id: string;
  title: string;
  slug: string;
  similarity: number;
  content: string;
}

export interface ChatPrefill {
  title: string;
  description: string;
}

export interface ChatResult {
  answer: string;
  sources: ChatSource[];
  suggestTicket: boolean;
  prefill: ChatPrefill | null;
  provider: string;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Data tambahan lokal di UI (tidak dikirim ke backend) */
  sources?: ChatSource[];
  suggestTicket?: boolean;
  prefill?: ChatPrefill | null;
  pending?: boolean;
  failed?: boolean;
}
