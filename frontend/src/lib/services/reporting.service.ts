import { api, API_BASE_URL } from '@/lib/api';
import { toApiError } from '@/lib/api-error';
import { tokenStore } from '@/lib/token-store';
import type { TicketPriority, TicketStatus } from '@/lib/types';

/**
 * Service reporting, survei CSAT, dan ekspor CSV.
 *
 * Semua endpoint di sini hanya untuk ADMIN kecuali `submitSurvey`.
 * Backend menegakkan lewat RolesGuard — UI hanya menyesuaikan tampilan.
 */

export interface DateRange {
  from?: string;
  to?: string;
}

export interface OverviewReport {
  range: { from: string; to: string };
  totals: {
    all: number;
    open: number;
    inProgress: number;
    waitingUser: number;
    resolved: number;
    closed: number;
    unassigned: number;
    highPriority: number;
  };
  completed: number;
  resolution: {
    /** null = belum ada tiket selesai, bukan 0. */
    mttrHours: number | null;
    mtfaHours: number | null;
  };
  sla: {
    compliancePercent: number | null;
    breached: number;
    breachRatePercent: number;
  };
  csat: {
    average: number | null;
    totalResponses: number;
    distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  };
}

export interface TrendPoint {
  date: string;
  created: number;
  resolved: number;
}

export interface CategoryReport {
  categoryId: string;
  categoryName: string;
  total: number;
  completed: number;
  avgResolutionHours: number | null;
  slaBreached: number;
}

export interface SlaRiskTicket {
  id: string;
  code: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  slaDueAt: string | null;
  overdue: boolean;
  hoursRemaining: number | null;
  assignee: { id: string; name: string } | null;
}

export interface CsatResponse {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  ticket: { id: string; code: string; title: string };
  user: { id: string; name: string };
}

/** GET /reporting/overview?from=&to= */
export function getOverview(range: DateRange = {}) {
  return api.get<OverviewReport>('/reporting/overview', { query: { ...range } });
}

/** GET /reporting/trend?from=&to= */
export function getTrend(range: DateRange = {}) {
  return api.get<TrendPoint[]>('/reporting/trend', { query: { ...range } });
}

/** GET /reporting/categories?from=&to= */
export function getCategoryReport(range: DateRange = {}) {
  return api.get<CategoryReport[]>('/reporting/categories', { query: { ...range } });
}

/** GET /reporting/sla-at-risk */
export function getSlaAtRisk() {
  return api.get<SlaRiskTicket[]>('/reporting/sla-at-risk');
}

/** POST /surveys/tickets/:id — hanya pelapor tiket yang sudah selesai. */
export function submitSurvey(ticketId: string, rating: number, comment?: string) {
  const body: Record<string, string | number> = { rating };
  if (comment?.trim()) body.comment = comment.trim();
  return api.post<CsatResponse>(`/surveys/tickets/${ticketId}`, body);
}

/** GET /surveys?limit= — ADMIN */
export function listSurveys(limit = 50) {
  return api.get<CsatResponse[]>('/surveys', { query: { limit } });
}

export type ExportKind = 'tickets' | 'overview' | 'sla-at-risk' | 'csat';

/**
 * Unduh laporan CSV.
 *
 * Butuh header Authorization, jadi tidak bisa pakai <a href> biasa —
 * file diambil lewat fetch lalu disimpan lewat object URL.
 */
export async function downloadCsv(kind: ExportKind, range: DateRange = {}) {
  const url = `${API_BASE_URL}/reporting/export/${kind}.csv`;
  const query = new URLSearchParams();
  if (range.from) query.set('from', range.from);
  if (range.to) query.set('to', range.to);
  const qs = query.toString();
  const fullUrl = qs ? `${url}?${qs}` : url;

  const response = await fetch(fullUrl, {
    headers: { Authorization: `Bearer ${tokenStore.getAccessToken() ?? ''}` },
  });
  if (!response.ok) throw await toApiError(response);

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  // Nama file dari header Content-Disposition bila ada (backend menaruhnya).
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? `laporan-${kind}.csv`;

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  return filename;
}