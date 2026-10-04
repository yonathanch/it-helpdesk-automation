import type {
  NotificationType,
  Role,
  TicketPriority,
  TicketStatus,
} from './types';

/**
 * Metadata tampilan terpusat agar label & warna konsisten di semua halaman.
 * Warna berasal dari design token (globals.css), bukan hex acak.
 */

export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Baru',
  IN_PROGRESS: 'Diproses',
  WAITING_USER: 'Menunggu Balasan',
  RESOLVED: 'Selesai',
  CLOSED: 'Ditutup',
};

export const STATUS_TONE: Record<TicketStatus, string> = {
  OPEN: 'var(--status-open)',
  IN_PROGRESS: 'var(--status-progress)',
  WAITING_USER: 'var(--status-waiting)',
  RESOLVED: 'var(--status-resolved)',
  CLOSED: 'var(--status-closed)',
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: 'Rendah',
  MEDIUM: 'Sedang',
  HIGH: 'Tinggi',
  URGENT: 'Mendesak',
};

export const PRIORITY_TONE: Record<TicketPriority, string> = {
  LOW: 'var(--priority-low)',
  MEDIUM: 'var(--priority-medium)',
  HIGH: 'var(--priority-high)',
  URGENT: 'var(--priority-urgent)',
};

/** Prioritas dengan angka untuk sorting (backend sortBy=priority). */
export const PRIORITY_RANK: Record<TicketPriority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  AGENT: 'Agen IT',
  END_USER: 'Pengguna',
};

export const NOTIFICATION_LABEL: Record<NotificationType, string> = {
  TICKET_CREATED: 'Tiket dibuat',
  TICKET_ASSIGNED: 'Tiket ditugaskan',
  TICKET_STATUS_CHANGED: 'Status berubah',
  SLA_BREACH: 'SLA terlampaui',
  GENERAL: 'Umum',
};

/** Label peran pada UI — dipakai sidebar agar navigasi sesuai hak akses. */
export const isStaff = (role: Role) => role === 'AGENT' || role === 'ADMIN';
export const isAdmin = (role: Role) => role === 'ADMIN';
