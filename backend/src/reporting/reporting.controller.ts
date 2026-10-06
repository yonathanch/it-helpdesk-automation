import { Controller, Get, Query, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../auth/roles.decorator';
import { ExportService } from './export.service';
import { ReportingService } from './reporting.service';

/**
 * Statistik operasional — hanya untuk ADMIN.
 * Otorisasi ditegakkan RolesGuard, bukan sekadar disembunyikan di UI.
 */
@ApiTags('Reporting')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: 'Token tidak ditemukan atau tidak valid',
})
@ApiForbiddenResponse({ description: 'Hanya ADMIN' })
@Roles(Role.ADMIN)
@Controller('reporting')
export class ReportingController {
  constructor(
    private readonly reporting: ReportingService,
    private readonly exporter: ExportService,
  ) {}

  @SkipThrottle()
  @Get('overview')
  @ApiOperation({
    summary: 'Ringkasan metrik dashboard',
    description: [
      'Mengembalikan total tiket per status, MTTR, SLA compliance, dan CSAT.',
      '',
      '**Definisi metrik:**',
      '- `mttrHours` — rata-rata waktu penyelesaian (jam), hanya menghitung',
      '  tiket yang sudah resolved/closed.',
      '- `compliancePercent` — % tiket selesai yang tidak melewati `slaDueAt`.',
      '- `csat.average` — rata-rata rating 1–5. `null` bila belum ada respons.',
      '',
      'Nilai `null` berarti tidak ada data, bukan nol.',
    ].join('\n'),
  })
  @ApiQuery({
    name: 'from',
    description: 'Tanggal awal (YYYY-MM-DD). Default: 30 hari terakhir.',
    required: false,
    example: '2026-09-01',
  })
  @ApiQuery({
    name: 'to',
    description: 'Tanggal akhir (YYYY-MM-DD). Default: hari ini.',
    required: false,
  })
  @ApiOkResponse({ description: 'Metrik ringkasan' })
  overview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reporting.overview({ from, to });
  }

  @SkipThrottle()
  @Get('trend')
  @ApiOperation({
    summary: 'Tren tiket dibuat vs diselesaikan per hari',
    description:
      'Dipakai grafik garis. Rentang dibatasi 180 hari agar respons tidak membanjiri klien.',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-09-01' })
  @ApiQuery({ name: 'to', required: false })
  @ApiOkResponse({
    description: 'Deret waktu per hari',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', example: '2026-10-01' },
          created: { type: 'integer', example: 12 },
          resolved: { type: 'integer', example: 9 },
        },
      },
    },
  })
  trend(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reporting.trend({ from, to });
  }

  @SkipThrottle()
  @Get('categories')
  @ApiOperation({
    summary: 'Performa per kategori',
    description:
      'Menunjukkan di mana beban IT terpusat: total, tiket selesai, rata-rata waktu penyelesaian, dan jumlah SLA terlampaui.',
  })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiOkResponse({ description: 'Statistik per kategori' })
  byCategory(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reporting.byCategory({ from, to });
  }

  @SkipThrottle()
  @Get('sla-at-risk')
  @ApiOperation({
    summary: 'Tiket berisiko SLA',
    description:
      'Tiket masih terbuka yang mendekati atau sudah melewati batas SLA, diurutkan dari yang paling mendesak. Perbandingan waktu memakai `slaDueAt` yang dihitung backend dari tabel `slas` — bukan asumsi ulang.',
  })
  @ApiOkResponse({
    description: 'Daftar tiket berisiko, paling mendesak di depan',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          code: { type: 'string', example: 'HD-0012' },
          title: { type: 'string' },
          status: { type: 'string', example: 'IN_PROGRESS' },
          priority: { type: 'string', example: 'HIGH' },
          slaDueAt: { type: 'string', format: 'date-time' },
          overdue: { type: 'boolean', example: false },
          hoursRemaining: { type: 'number', example: -3.5 },
          assignee: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      },
    },
  })
  slaAtRisk() {
    return this.reporting.slaAtRisk();
  }

  // ============ Ekspor CSV ============

  @Get('export/tickets.csv')
  @ApiOperation({
    summary: 'Unduh daftar tiket (CSV)',
    description:
      'Menghasilkan berkas CSV yang bisa langsung dibuka di Excel. Difilter dengan parameter `from`/`to` yang sama seperti endpoint lain.',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-09-01' })
  @ApiQuery({ name: 'to', required: false })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'Berkas CSV',
    schema: { type: 'string', format: 'binary' },
  })
  async exportTickets(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const file = await this.exporter.ticketsCsv({ from, to });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.content);
  }

  @Get('export/overview.csv')
  @ApiOperation({
    summary: 'Unduh ringkasan metrik (CSV)',
    description:
      'Satu baris per metrik: total tiket, MTTR, SLA compliance, CSAT.',
  })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'Berkas CSV',
    schema: { type: 'string', format: 'binary' },
  })
  async exportOverview(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const file = await this.exporter.overviewCsv({ from, to });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.content);
  }

  @Get('export/sla-at-risk.csv')
  @ApiOperation({
    summary: 'Unduh daftar tiket berisiko SLA (CSV)',
    description:
      'Tiket yang mendekati atau melewati batas SLA, paling mendesak di atas.',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'Berkas CSV',
    schema: { type: 'string', format: 'binary' },
  })
  async exportSlaAtRisk(@Res() res: Response) {
    const file = await this.exporter.slaAtRiskCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.content);
  }

  @Get('export/csat.csv')
  @ApiOperation({
    summary: 'Unduh hasil survei CSAT (CSV)',
    description: 'Daftar penilaian kepuasan beserta tiket dan nama pelapor.',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'Berkas CSV',
    schema: { type: 'string', format: 'binary' },
  })
  async exportCsat(@Res() res: Response) {
    const file = await this.exporter.csatCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.content);
  }
}
