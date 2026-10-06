import { ConfigService } from '@nestjs/config';
import { NotificationType, TicketStatus } from '@prisma/client';
import { SlaCheckJob } from './sla-check.job';

/**
 * Mock Queue/Worker BullMQ supaya unit test tidak membuka koneksi Redis
 * sungguhan (koneksi nyata membuat Jest menggantung dan tidak keluar di CI).
 * Yang diuji di sini adalah logika runCheck, bukan perilaku antrean.
 */
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('SlaCheckJob', () => {
  let job: SlaCheckJob;
  const prisma = {
    ticket: { findMany: jest.fn(), update: jest.fn() },
  };
  const notifications = {
    notify: jest.fn().mockResolvedValue({}),
    notifyByRole: jest.fn().mockResolvedValue([]),
  };
  // M4-2: webhook kanal eksternal
  const webhooks = {
    slaBreached: jest.fn().mockResolvedValue(undefined),
    ticketCreated: jest.fn().mockResolvedValue(undefined),
    ticketAssigned: jest.fn().mockResolvedValue(undefined),
    ticketStatusChanged: jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'REDIS_PORT' ? '6379' : 'localhost',
    ),
  };

  beforeAll(() => {
    job = new SlaCheckJob(
      prisma as never,
      notifications as never,
      webhooks as never,
      config as unknown as ConfigService,
    );
  });

  afterAll(async () => {
    await job.onModuleDestroy();
  });

  beforeEach(() => jest.clearAllMocks());

  it('menandai breach & memberi notifikasi ke assignee', async () => {
    const tickets = [
      {
        id: 't1',
        code: 'HD-0009',
        title: 'Server down',
        priority: 'URGENT',
        assigneeId: 'agent-1',
        category: { name: 'Network' },
      },
    ];
    prisma.ticket.findMany.mockResolvedValue(tickets);
    prisma.ticket.update.mockResolvedValue({});

    const result = await job.runCheck();

    expect(result.breached).toBe(1);
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: { slaBreachedAt: expect.any(Date) },
      }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({ type: NotificationType.SLA_BREACH }),
    );
  });

  it('tiket tanpa assignee → notifikasi broadcast ke agen/admin', async () => {
    prisma.ticket.findMany.mockResolvedValue([
      {
        id: 't2',
        code: 'HD-0010',
        title: 'Laptop hang',
        priority: 'HIGH',
        assigneeId: null,
        category: { name: 'Hardware' },
      },
    ]);
    prisma.ticket.update.mockResolvedValue({});

    await job.runCheck();

    expect(notifications.notifyByRole).toHaveBeenCalledWith(
      ['AGENT', 'ADMIN'],
      expect.objectContaining({ type: NotificationType.SLA_BREACH }),
    );
  });

  it('tidak ada tiket breach → tidak ada aksi', async () => {
    prisma.ticket.findMany.mockResolvedValue([]);

    const result = await job.runCheck();

    expect(result.breached).toBe(0);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('query hanya mengambil tiket belum selesai', async () => {
    prisma.ticket.findMany.mockResolvedValue([]);

    await job.runCheck();

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          slaBreachedAt: null,
          status: {
            notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED],
          },
        }),
      }),
    );
  });
});
