import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportingService, type ReportingQuery } from './reporting.service';

export interface CsvFile {
  filename: string;
  content: string;
}

/**
 * Ekspor laporan ke CSV.
 *
 * Dua hal penting yang sering terlewat dan ikut ditangani di sini:
 * 1. **CSV injection** — nilai diawali `=`, `+`, `-`, `@` akan dieksekusi
 *    oleh Excel/Sheets. Semua nilai diawali kutip, dan sel yang diawali
 *    karakter berbahaya diberi prefiks `'` agar jadi teks biasa.
 * 2. **BOM UTF-8** — tanpa BOM, Excel di Windows membaca karakter non-ASCII
 *    (mis. Indonesia) jadi karakter aneh.
 */
@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reporting: ReportingService,
  ) {}

  /** Daftar tiket sesuai filter yang sama dengan GET /tickets. */
  async ticketsCsv(query: ReportingQuery): Promise<CsvFile> {
    const { from, to } = this.resolveRange(query);

    const tickets = await this.prisma.ticket.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { name: true } },
        requester: { select: { name: true, email: true } },
        assignee: { select: { name: true, email: true } },
      },
    });

    const header = [
      'Kode',
      'Judul',
      'Kategori',
      'Status',
      'Prioritas',
      'Pelapor',
      'Email Pelapor',
      'Ditugaskan Ke',
      'Dibuat',
      'Diselesaikan',
      'Batas SLA',
      'SLA Terlampaui',
      'TerAI',
    ];

    const rows = tickets.map((t) => [
      t.code,
      t.title,
      t.category.name,
      t.status,
      t.priority,
      t.requester.name,
      t.requester.email,
      t.assignee?.name ?? '',
      this.fmt(t.createdAt),
      t.resolvedAt ? this.fmt(t.resolvedAt) : '',
      t.slaDueAt ? this.fmt(t.slaDueAt) : '',
      t.slaBreachedAt ? this.fmt(t.slaBreachedAt) : '',
      t.aiTriaged ? 'ya' : 'tidak',
    ]);

    return {
      filename: `tickets-${this.stamp(from)}-${this.stamp(to)}.csv`,
      content: this.toCsv(header, rows),
    };
  }

  /** Tiket berisiko SLA, urut paling mendesak. */
  async slaAtRiskCsv(): Promise<CsvFile> {
    const tickets = await this.reporting.slaAtRisk();

    const header = [
      'Kode',
      'Judul',
      'Status',
      'Prioritas',
      'Batas SLA',
      'Status SLA',
      'Jam Tersisa',
      'Ditugaskan Ke',
    ];

    const rows = tickets.map((t) => [
      t.code,
      t.title,
      t.status,
      t.priority,
      this.fmt(new Date(t.slaDueAt!)),
      t.overdue ? 'TERLAMBAT' : 'dalam batas',
      String(t.hoursRemaining),
      t.assignee?.name ?? '',
    ]);

    return {
      filename: `sla-at-risk-${this.stamp(new Date())}.csv`,
      content: this.toCsv(header, rows),
    };
  }

  /** Hasil survei kepuasan beserta tiketnya. */
  async csatCsv(): Promise<CsvFile> {
    const surveys = await this.prisma.cSATSurvey.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        ticket: { select: { code: true, title: true } },
        user: { select: { name: true } },
      },
    });

    const header = [
      'Tiket',
      'Judul Tiket',
      'Rating',
      'Komentar',
      'Penilai',
      'Tanggal',
    ];

    const rows = surveys.map((s) => [
      s.ticket.code,
      s.ticket.title,
      String(s.rating),
      s.comment ?? '',
      s.user.name,
      this.fmt(s.createdAt),
    ]);

    return {
      filename: `csat-${this.stamp(new Date())}.csv`,
      content: this.toCsv(header, rows),
    };
  }

  /** Ringkasan metrik sebagai CSV (satu baris nilai). */
  async overviewCsv(query: ReportingQuery): Promise<CsvFile> {
    const data = await this.reporting.overview(query);

    const header = ['Metrik', 'Nilai'];

    // Penanda "tidak ada data". Sengaja BUKAN '-' karena diawali '-' dan akan
    // diserialisasi sebagai formula oleh Excel; memakai teks netral.
    const NO_DATA = 'n/a';

    const rows: string[][] = [
      ['Periode dari', data.range.from],
      ['Periode sampai', data.range.to],
      ['Total tiket', String(data.totals.all)],
      ['Baru', String(data.totals.open)],
      ['Diproses', String(data.totals.inProgress)],
      ['Menunggu balasan', String(data.totals.waitingUser)],
      ['Selesai', String(data.totals.resolved)],
      ['Ditutup', String(data.totals.closed)],
      ['Belum ditugaskan', String(data.totals.unassigned)],
      ['Prioritas tinggi', String(data.totals.highPriority)],
      [
        'MTTR (jam)',
        data.resolution.mttrHours === null
          ? NO_DATA
          : String(data.resolution.mttrHours),
      ],
      [
        'MTFA (jam)',
        data.resolution.mtfaHours === null
          ? NO_DATA
          : String(data.resolution.mtfaHours),
      ],
      [
        'SLA compliance (%)',
        data.sla.compliancePercent === null
          ? NO_DATA
          : String(data.sla.compliancePercent),
      ],
      ['Tiket SLA terlampaui', String(data.sla.breached)],
      [
        'CSAT rata-rata',
        data.csat.average === null ? NO_DATA : String(data.csat.average),
      ],
      ['Jumlah respons CSAT', String(data.csat.totalResponses)],
    ];

    return {
      filename: `overview-${this.stamp(new Date())}.csv`,
      content: this.toCsv(header, rows),
    };
  }

  // ---------------- helper ----------------

  /** Bangun CSV sesuai RFC 4180 + proteksi CSV injection. */
  private toCsv(header: string[], rows: string[][]): string {
    const lines = [
      header.map((h) => this.cell(h)).join(','),
      ...rows.map((row) => row.map((cell) => this.cell(cell)).join(',')),
    ];
    // BOM UTF-8 supaya Excel membaca karakter non-ASCII dengan benar.
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  }

  /** Escape satu sel. Nilai berbahaya diubah jadi teks biasa. */
  private cell(value: string): string {
    const raw = value ?? '';
    // Cegah formula injection: Excel akan mengeksekusi =cmd|... dsb.
    const needsQuote =
      raw.startsWith('=') ||
      raw.startsWith('+') ||
      raw.startsWith('-') ||
      raw.startsWith('@') ||
      raw.startsWith('\t') ||
      raw.startsWith('\r');
    const safe = needsQuote ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  private fmt(date: Date): string {
    return date.toISOString();
  }

  private stamp(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private resolveRange(query: ReportingQuery) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 3_600_000);

    if (Number.isNaN(from.getTime())) {
      return { from: new Date(to.getTime() - 30 * 24 * 3_600_000), to };
    }
    if (Number.isNaN(to.getTime())) {
      return {
        from: new Date(Date.now() - 30 * 24 * 3_600_000),
        to: new Date(),
      };
    }
    return { from, to };
  }
}
