import { NotFoundException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { RoutingService } from './routing.service';

describe('A-6: RoutingService', () => {
  let service: RoutingService;

  const prisma = {
    ticket: { findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
    user: { findMany: jest.fn() },
  };
  const notifications = { notify: jest.fn().mockResolvedValue({}) };

  const ticket = {
    id: 't1',
    code: 'HD-0001',
    title: 'VPN error',
    status: TicketStatus.OPEN,
    categoryId: 'cat-net',
    assigneeId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RoutingService(prisma as never, notifications as never);
    prisma.ticket.findUnique.mockResolvedValue({ ...ticket });
    prisma.ticket.update.mockResolvedValue({ id: 't1' });
    prisma.user.findMany.mockResolvedValue([
      { id: 'a1', name: 'Agent Satu', createdAt: new Date('2026-01-01') },
      { id: 'a2', name: 'Agent Dua', createdAt: new Date('2026-02-01') },
    ]);
  });

  /** count di-stub per (agent, jenis): workload vs pengalaman kategori */
  const setCounts = (
    workloads: [number, number],
    experiences: [number, number],
  ) => {
    const agents = ['a1', 'a2'];
    prisma.ticket.count.mockImplementation(
      (args: { where: { assigneeId: string; categoryId?: string } }) => {
        const idx = agents.indexOf(args.where.assigneeId);
        return Promise.resolve(
          args.where.categoryId !== undefined
            ? experiences[idx]
            : workloads[idx],
        );
      },
    );
  };

  it('memilih agen dengan skor terendah (beban − pengalaman kategori)', async () => {
    // a1: beban 3, exp 0 → skor 3; a2: beban 4, exp 3 → skor 1 → menang
    setCounts([3, 4], [0, 3]);

    const result = await service.autoAssign('t1');

    expect(result.assigned).toBe(true);
    expect(result.assigneeId).toBe('a2');
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: { assigneeId: 'a2' },
      }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      'a2',
      expect.objectContaining({
        title: expect.stringContaining('HD-0001'),
      }),
    );
  });

  it('skor imbang → beban lebih ringan menang, lalu agen paling senior', async () => {
    // a1: beban 2 exp 0 → 2; a2: beban 5 exp 3 → 2. Imbang skor → a1 (beban 2 < 5)
    setCounts([2, 5], [0, 3]);

    const result = await service.autoAssign('t1');

    expect(result.assigneeId).toBe('a1');
  });

  it('sudah punya agen → dilewati tanpa force', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      assigneeId: 'a1',
    });

    const result = await service.autoAssign('t1');

    expect(result.assigned).toBe(false);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('force=true → re-route tetap jalan walau sudah ada agen', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      assigneeId: 'a1',
    });
    setCounts([0, 0], [0, 0]);

    const result = await service.autoAssign('t1', { force: true });

    expect(result.assigned).toBe(true);
  });

  it('tiket CLOSED → tidak di-route', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: TicketStatus.CLOSED,
    });

    const result = await service.autoAssign('t1');

    expect(result.assigned).toBe(false);
    expect(result.reason).toContain('CLOSED');
  });

  it('tidak ada agen aktif → assigned=false', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    const result = await service.autoAssign('t1');

    expect(result.assigned).toBe(false);
    expect(result.reason).toContain('tidak ada agen');
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('tiket tidak ada → NotFoundException', async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);

    await expect(service.autoAssign('t-404')).rejects.toThrow(
      NotFoundException,
    );
  });
});
