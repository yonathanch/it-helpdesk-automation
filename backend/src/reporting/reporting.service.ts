import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { TicketPriority, TicketStatus } from '@prisma/client';

/**
 * Statistik & laporan operasional.
 *
 * Definisi metrik (penting agar tidak ambigu):
 * - **MTTR** (Mean Time To Resolution): rata-rata selisih `resolvedAt -
 *   createdAt` untuk tiket yang sudah resolved/closed. Tiket yang belum
 *   selesai tidak dihitung, jadi nilainya hanya mencakup tiket selesai.
 * - **SLA compliance**: persentase tiket selesai yang `resolvedAt` tidak
 *   melewati `slaDueAt`. Membandingkan waktu aktual vs aturan di tabel
 *   `slas` — bukan asumsi ulang.
 * - **SLA breach rate**: persentase seluruh tiket yang punya `slaBreachedAt`
 *   terisi (diisi job B-6 otomatis).
 * - **CSAT**: rata-rata `rating` (1–5) dari tabel `csat_surveys`.
 */

export interface ReportingQuery {
  /** Filter tanggal pembuatan tiket, format YYYY-MM-DD. Default: 30 hari terakhir. */
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
  /** Tiket yang sudah selesai (resolved atau closed). */
  completed: number;
  resolution: {
    /** Rata-rata waktu penyelesaian dalam jam. null bila belum ada tiket selesai. */
    mttrHours: number | null;
    /** Rata-rata waktu respons pertama dalam jam. */
    mtfaHours: number | null;
  };
  sla: {
    /** 0–100. Persentase tiket selesai tepat waktu. null bila tidak ada sampel. */
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

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ringkasan metrik utama untuk dashboard admin. */
  async overview(query: ReportingQuery = {}): Promise<OverviewReport> {
    const { from, to } = this.resolveRange(query);

    const where = { createdAt: { gte: from, lte: to } };

    const [
      all,
      open,
      inProgress,
      waitingUser,
      resolved,
      closed,
      unassigned,
      highPriority,
      resolvedTickets,
      firstReplies,
      breached,
      surveys,
    ] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.count({
        where: { ...where, status: 'OPEN' },
      }),
      this.prisma.ticket.count({
        where: { ...where, status: 'IN_PROGRESS' },
      }),
      this.prisma.ticket.count({
        where: { ...where, status: 'WAITING_USER' },
      }),
      this.prisma.ticket.count({
        where: { ...where, status: 'RESOLVED' },
      }),
      this.prisma.ticket.count({
        where: { ...where, status: 'CLOSED' },
      }),
      this.prisma.ticket.count({
        where: { ...where, assigneeId: null },
      }),
      this.prisma.ticket.count({
        where: {
          ...where,
          priority: { in: ['HIGH', 'URGENT'] as TicketPriority[] },
        },
      }),
      this.prisma.ticket.findMany({
        where: {
          ...where,
          resolvedAt: { not: null },
        },
        select: {
          createdAt: true,
          resolvedAt: true,
          firstReplyAt: true,
          slaDueAt: true,
        },
      }),
      this.prisma.ticket.findMany({
        where: { ...where, firstReplyAt: { not: null } },
        select: { createdAt: true, firstReplyAt: true },
      }),
      this.prisma.ticket.count({
        where: { ...where, slaBreachedAt: { not: null } },
      }),
      this.prisma.cSATSurvey.findMany({ select: { rating: true } }),
    ]);

    // --- MTTR: hanya tiket yang benar-benar selesai ---
    const resolutionHours = resolvedTickets
      .filter((t) => t.resolvedAt)
      .map(
        (t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3_600_000,
      );

    const mttrHours = this.average(resolutionHours);

    const firstReplyHours = firstReplies.map(
      (t) => (t.firstReplyAt!.getTime() - t.createdAt.getTime()) / 3_600_000,
    );

    // --- SLA compliance: selesai tepat waktu vs melewati batas ---
    const withDue = resolvedTickets.filter((t) => t.slaDueAt && t.resolvedAt);
    const onTime = withDue.filter(
      (t) => t.resolvedAt!.getTime() <= t.slaDueAt!.getTime(),
    ).length;
    const compliancePercent =
      withDue.length > 0
        ? Number(((onTime / withDue.length) * 100).toFixed(1))
        : null;

    // --- CSAT ---
    const distribution: Record<'1' | '2' | '3' | '4' | '5', number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    for (const survey of surveys) {
      const key = String(
        Math.min(5, Math.max(1, Math.round(survey.rating))),
      ) as '1' | '2' | '3' | '4' | '5';
      distribution[key] += 1;
    }

    return {
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      totals: {
        all,
        open,
        inProgress,
        waitingUser,
        resolved,
        closed,
        unassigned,
        highPriority,
      },
      completed: resolved + closed,
      resolution: {
        mttrHours: mttrHours === null ? null : Number(mttrHours.toFixed(2)),
        mtfaHours:
          this.average(firstReplyHours) === null
            ? null
            : Number(this.average(firstReplyHours)!.toFixed(2)),
      },
      sla: {
        compliancePercent,
        breached,
        breachRatePercent:
          all > 0 ? Number(((breached / all) * 100).toFixed(1)) : 0,
      },
      csat: {
        average:
          surveys.length > 0
            ? Number(
                (
                  surveys.reduce((sum, s) => sum + s.rating, 0) / surveys.length
                ).toFixed(2),
              )
            : null,
        totalResponses: surveys.length,
        distribution,
      },
    };
  }

  /** Tren tiket dibuat vs diselesaikan per hari. */
  async trend(query: ReportingQuery = {}): Promise<TrendPoint[]> {
    const { from, to } = this.resolveRange(query);

    const tickets = await this.prisma.ticket.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { createdAt: true, resolvedAt: true },
    });

    const days = this.dayRange(from, to);
    const created = new Map<string, number>();
    const resolved = new Map<string, number>();

    for (const day of days) {
      created.set(day, 0);
      resolved.set(day, 0);
    }

    for (const ticket of tickets) {
      const createdKey = this.toDayKey(ticket.createdAt);
      if (created.has(createdKey)) {
        created.set(createdKey, created.get(createdKey)! + 1);
      }
      if (ticket.resolvedAt) {
        const resolvedKey = this.toDayKey(ticket.resolvedAt);
        if (resolved.has(resolvedKey)) {
          resolved.set(resolvedKey, resolved.get(resolvedKey)! + 1);
        }
      }
    }

    return days.map((day) => ({
      date: day,
      created: created.get(day) ?? 0,
      resolved: resolved.get(day) ?? 0,
    }));
  }

  /** Performa per kategori — berguna melihat di mana beban IT terpusat. */
  async byCategory(query: ReportingQuery = {}): Promise<CategoryReport[]> {
    const { from, to } = this.resolveRange(query);

    const tickets = await this.prisma.ticket.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        categoryId: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        slaBreachedAt: true,
        category: { select: { name: true } },
      },
    });

    const grouped = new Map<string, { name: string; items: typeof tickets }>();

    for (const ticket of tickets) {
      const existing = grouped.get(ticket.categoryId);
      if (existing) existing.items.push(ticket);
      else
        grouped.set(ticket.categoryId, {
          name: ticket.category.name,
          items: [ticket],
        });
    }

    return [...grouped.entries()]
      .map(([categoryId, { name, items }]) => {
        const done = items.filter(
          (t) => t.status === 'RESOLVED' || t.status === 'CLOSED',
        );
        const resolutionHours = done
          .filter((t) => t.resolvedAt)
          .map(
            (t) =>
              (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3_600_000,
          );
        const avg = this.average(resolutionHours);

        return {
          categoryId,
          categoryName: name,
          total: items.length,
          completed: done.length,
          avgResolutionHours: avg === null ? null : Number(avg.toFixed(2)),
          slaBreached: items.filter((t) => t.slaBreachedAt !== null).length,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Tiket yang mendekati atau sudah melewati batas SLA.
   * Prioritas diurutkan dengan ticketing deadline yang paling mendesak.
   */
  async slaAtRisk(): Promise<
    Array<{
      id: string;
      code: string;
      title: string;
      status: TicketStatus;
      priority: TicketPriority;
      slaDueAt: string | null;
      overdue: boolean;
      hoursRemaining: number | null;
      assignee: { id: string; name: string } | null;
    }>
  > {
    const now = new Date();

    const tickets = await this.prisma.ticket.findMany({
      where: {
        status: {
          in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER'] as TicketStatus[],
        },
        slaDueAt: { not: null },
      },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        priority: true,
        slaDueAt: true,
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { slaDueAt: 'asc' },
    });

    return tickets
      .map((t) => {
        const due = t.slaDueAt!;
        const diffMs = due.getTime() - now.getTime();
        return {
          id: t.id,
          code: t.code,
          title: t.title,
          status: t.status,
          priority: t.priority,
          slaDueAt: due.toISOString(),
          overdue: diffMs < 0,
          hoursRemaining: Number((diffMs / 3_600_000).toFixed(1)),
          assignee: t.assignee,
        };
      })
      .sort((a, b) => {
        // Yang lewat batas didahulukan, lalu paling dekat dengan batas.
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return a.hoursRemaining - b.hoursRemaining;
      });
  }

  // ---------------- helper ----------------

  /**
   * Ubah query rentang menjadi batas waktu yang bisa dipakai Prisma.
   *
   * Penting: `YYYY-MM-DD` dianggap sebagai HARI PENUH, bukan titik
   * tengah malam. Tanpa ini, filter `to: hari-ini` akan memotong semua tiket
   * yang dibuat setelah 00:00 — dashboard tampak kosong padahal ada data.
   * Semua batas dihitung dalam UTC agar konsisten dengan toDayKey().
   */
  private resolveRange(query: ReportingQuery) {
    const to = ReportingService.endOfDay(query.to) ?? new Date();
    // Default: 30 hari terakhir.
    const from =
      ReportingService.startOfDay(query.from) ??
      new Date(to.getTime() - 30 * 24 * 3_600_000);

    // Bila `from` lebih besar dari `to`, tukar agar hasil tidak selalu nol.
    return from.getTime() > to.getTime()
      ? { from: to, to: from }
      : { from, to };
  }

  /** Awal hari UTC dari string `YYYY-MM-DD` (atau tengah malam bila tanggal penuh). */
  private static startOfDay(value?: string): Date | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ) === date.getTime()
      ? date
      : new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
          ),
        );
  }

  /** Akhir hari UTC dari string `YYYY-MM-DD`, atau waktu sekarang bila kosong. */
  private static endOfDay(value?: string): Date | null {
    if (!value) return null;
    const start = ReportingService.startOfDay(value);
    if (!start) return null;
    return new Date(start.getTime() + 24 * 3_600_000 - 1);
  }

  private average(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private toDayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Daftar hari dalam rentang, memakai UTC seluruhnya.
   *
   * Penting: toDayKey() juga menghasilkan format UTC, jadi pengelompokan
   * hari di sini harus berbasis UTC juga. Kalau memakai jam lokal, hari
   * terakhir bisa bergeser satu hari dari label yang ditampilkan.
   */
  private dayRange(from: Date, to: Date): string[] {
    const days: string[] = [];

    // Awal hari UTC dari tanggal `from`.
    const cursor = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
    );

    // Batas aman agar rentang tidak membanjiri respons.
    const MAX_DAYS = 180;

    while (cursor <= to && days.length < MAX_DAYS) {
      days.push(this.toDayKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
  }
}
