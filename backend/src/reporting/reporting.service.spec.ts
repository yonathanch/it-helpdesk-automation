import { ReportingService } from './reporting.service';

describe('M4-3: ReportingService', () => {
  let service: ReportingService;

  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

  const buildPrisma = (overrides: Record<string, unknown> = {}) => ({
    ticket: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      ...(overrides.ticket ?? {}),
    },
    cSATSurvey: {
      findMany: jest.fn().mockResolvedValue([]),
      ...(overrides.cSATSurvey ?? {}),
    },
  });

  beforeEach(() => {
    service = new ReportingService(buildPrisma() as unknown as never);
  });

  describe('overview', () => {
    it('menghitung MTTR hanya dari tiket yang selesai', async () => {
      const prisma = buildPrisma();
      prisma.ticket.findMany.mockImplementation(
        (args: { where?: { resolvedAt?: { not: null } } }) => {
          // Query pertama = tiket selesai, query kedua = first reply.
          if (args.where?.resolvedAt) {
            return Promise.resolve([
              {
                createdAt: hoursAgo(10),
                resolvedAt: hoursAgo(8),
                firstReplyAt: null,
                slaDueAt: hoursAgo(7),
              },
              {
                createdAt: hoursAgo(20),
                resolvedAt: hoursAgo(14),
                firstReplyAt: null,
                slaDueAt: hoursAgo(18),
              },
            ]);
          }
          return Promise.resolve([
            { createdAt: hoursAgo(20), firstReplyAt: hoursAgo(19) },
          ]);
        },
      );
      service = new ReportingService(prisma as unknown as never);

      const result = await service.overview();

      // (2 + 6) / 2 = 4 jam
      expect(result.resolution.mttrHours).toBe(4);
      // 1 jam
      expect(result.resolution.mtfaHours).toBe(1);
    });

    it('MTTR null bila belum ada tiket selesai', async () => {
      const result = await service.overview();
      expect(result.resolution.mttrHours).toBeNull();
      expect(result.resolution.mtfaHours).toBeNull();
      expect(result.sla.compliancePercent).toBeNull();
      expect(result.csat.average).toBeNull();
    });

    it('menghitung SLA compliance dari perbandingan resolvedAt vs slaDueAt', async () => {
      const prisma = buildPrisma();
      prisma.ticket.count.mockResolvedValue(4);
      prisma.ticket.findMany.mockImplementation(
        (args: { where?: { resolvedAt?: { not: null } } }) => {
          if (args.where?.resolvedAt) {
            return Promise.resolve([
              // selesai sebelum batas → tepat waktu
              {
                createdAt: hoursAgo(30),
                resolvedAt: hoursAgo(28),
                firstReplyAt: null,
                slaDueAt: hoursAgo(25),
              },
              // selesai setelah batas → terlambat
              {
                createdAt: hoursAgo(30),
                resolvedAt: hoursAgo(10),
                firstReplyAt: null,
                slaDueAt: hoursAgo(20),
              },
              // tanpa slaDueAt → tidak masuk hitungan compliance
              {
                createdAt: hoursAgo(30),
                resolvedAt: hoursAgo(5),
                firstReplyAt: null,
                slaDueAt: null,
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );
      service = new ReportingService(prisma as unknown as never);

      const result = await service.overview();

      // 2 tiket punya SLA, 1 tepat waktu → 50%
      expect(result.sla.compliancePercent).toBe(50);
    });

    it('menghitung rata-rata CSAT dan distribusinya', async () => {
      const prisma = buildPrisma();
      prisma.cSATSurvey.findMany.mockResolvedValue([
        { rating: 5 },
        { rating: 4 },
        { rating: 3 },
        { rating: 5 },
      ]);
      service = new ReportingService(prisma as unknown as never);

      const result = await service.overview();

      expect(result.csat.totalResponses).toBe(4);
      expect(result.csat.average).toBe(4.25);
      expect(result.csat.distribution['5']).toBe(2);
      expect(result.csat.distribution['3']).toBe(1);
    });
  });

  describe('trend', () => {
    it('menghitung jumlah dibuat vs diselesaikan per hari', async () => {
      const prisma = buildPrisma();
      prisma.ticket.findMany.mockResolvedValue([
        { createdAt: new Date(), resolvedAt: null },
        { createdAt: new Date(), resolvedAt: new Date() },
      ]);
      service = new ReportingService(prisma as unknown as never);

      const points = await service.trend({
        from: new Date(Date.now() - 3 * 24 * 3_600_000)
          .toISOString()
          .slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
      });

      expect(points.length).toBeGreaterThan(0);
      const today = points[points.length - 1];
      expect(today.created).toBe(2);
      expect(today.resolved).toBe(1);
    });
  });

  describe('byCategory', () => {
    it('mengelompokkan statistik per kategori, urut dari total terbesar', async () => {
      const prisma = buildPrisma();
      prisma.ticket.findMany.mockResolvedValue([
        {
          categoryId: 'c1',
          status: 'RESOLVED',
          createdAt: hoursAgo(5),
          resolvedAt: hoursAgo(3),
          slaBreachedAt: null,
          category: { name: 'Jaringan' },
        },
        {
          categoryId: 'c2',
          status: 'OPEN',
          createdAt: hoursAgo(2),
          resolvedAt: null,
          slaBreachedAt: null,
          category: { name: 'Hardware' },
        },
        {
          categoryId: 'c2',
          status: 'OPEN',
          createdAt: hoursAgo(2),
          resolvedAt: null,
          slaBreachedAt: new Date(),
          category: { name: 'Hardware' },
        },
      ]);
      service = new ReportingService(prisma as unknown as never);

      const result = await service.byCategory();

      expect(result).toHaveLength(2);
      // c2 punya 2 tiket, jadi harus di depan
      expect(result[0].categoryName).toBe('Hardware');
      expect(result[0].total).toBe(2);
      expect(result[0].slaBreached).toBe(1);
      expect(result[1].categoryName).toBe('Jaringan');
      expect(result[1].avgResolutionHours).toBe(2);
    });
  });

  describe('filter rentang tanggal', () => {
    /** Ambil batas waktu dari argumen where yang dikirim ke prisma. */
    const capturedRange = (prisma: ReturnType<typeof buildPrisma>) => {
      const call = prisma.ticket.count.mock.calls[0][0] as {
        where: { createdAt: { gte: Date; lte: Date } };
      };
      return call.where.createdAt;
    };

    it('menganggap to=YYYY-MM-DD sebagai akhir hari, bukan tengah malam', async () => {
      const prisma = buildPrisma();
      service = new ReportingService(prisma as unknown as never);

      const today = new Date().toISOString().slice(0, 10);
      await service.overview({ from: today, to: today });

      const { lte } = capturedRange(prisma);

      // Tiket dibuat pada pukul 20:45 hari ini harus tetap dihitung.
      expect(lte.getTime()).toBeGreaterThan(
        new Date(`${today}T20:00:00Z`).getTime(),
      );
      expect(lte.getUTCHours()).toBe(23);
    });

    it('memakai awal hari UTC untuk from', async () => {
      const prisma = buildPrisma();
      service = new ReportingService(prisma as unknown as never);

      await service.overview({ from: '2026-09-04', to: '2026-09-10' });

      const { gte } = capturedRange(prisma);

      expect(gte.toISOString()).toBe('2026-09-04T00:00:00.000Z');
    });

    it('menukar from dan to bila urutannya terbalik', async () => {
      const prisma = buildPrisma();
      service = new ReportingService(prisma as unknown as never);

      await service.overview({ from: '2026-09-10', to: '2026-09-04' });

      const { gte, lte } = capturedRange(prisma);
      expect(gte.getTime()).toBeLessThanOrEqual(lte.getTime());
    });
  });

  describe('slaAtRisk', () => {
    it('menaruh tiket yang lewat batas di urutan teratas', async () => {
      const prisma = buildPrisma();
      prisma.ticket.findMany.mockResolvedValue([
        {
          id: '1',
          code: 'HD-0001',
          title: 'Belum lewat',
          status: 'OPEN',
          priority: 'LOW',
          slaDueAt: new Date(Date.now() + 3_600_000),
          assignee: null,
        },
        {
          id: '2',
          code: 'HD-0002',
          title: 'Sudah lewat',
          status: 'IN_PROGRESS',
          priority: 'URGENT',
          slaDueAt: new Date(Date.now() - 7_200_000),
          assignee: { id: 'a1', name: 'Agen' },
        },
      ]);
      service = new ReportingService(prisma as unknown as never);

      const result = await service.slaAtRisk();

      expect(result[0].code).toBe('HD-0002');
      expect(result[0].overdue).toBe(true);
      expect(result[0].hoursRemaining).toBeLessThan(0);
      expect(result[1].overdue).toBe(false);
    });
  });
});
