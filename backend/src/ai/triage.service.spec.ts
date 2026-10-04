import { NotFoundException } from '@nestjs/common';
import { TicketPriority } from '@prisma/client';
import { TriageService, TriageResult } from './triage.service';

describe('A-2: TriageService', () => {
  let service: TriageService;

  const prisma = {
    ticket: { findUnique: jest.fn(), update: jest.fn() },
    category: { findMany: jest.fn(), findUnique: jest.fn() },
  };
  const ai = { completeJson: jest.fn() };
  const notifications = { notifyByRole: jest.fn().mockResolvedValue([]) };

  const baseTicket = {
    id: 't1',
    code: 'HD-0010',
    title: 'VPN error',
    description: 'tidak bisa connect',
    priority: TicketPriority.MEDIUM,
    categoryId: 'cat-old',
    aiTriaged: false,
  };

  const result = (overrides: Partial<TriageResult> = {}): TriageResult => ({
    categorySlug: 'network',
    priority: TicketPriority.MEDIUM,
    sentiment: 'neutral',
    confidence: 0.9,
    reason: 'ok',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TriageService(
      prisma as never,
      ai as never,
      notifications as never,
    );
    prisma.category.findMany.mockResolvedValue([
      { slug: 'network', name: 'Network', description: null },
      { slug: 'hardware', name: 'Hardware', description: null },
      { slug: 'akun-akses', name: 'Akun', description: null },
    ]);
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-network' });
    prisma.ticket.update.mockResolvedValue({});
    prisma.ticket.findUnique.mockResolvedValue({ ...baseTicket });
  });

  it('menyimpan hasil triage (kategori, prioritas, sentimen, confidence)', async () => {
    ai.completeJson.mockResolvedValue(result());

    const out = await service.triage('t1');

    expect(out.updated).toBe(true);
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: expect.objectContaining({
          categoryId: 'cat-network',
          priority: TicketPriority.MEDIUM,
          aiTriaged: true,
          aiSentiment: 'neutral',
          aiConfidence: 0.9,
        }),
      }),
    );
  });

  it('ESCALASI prioritas saat sentimen negatif (user frustrasi)', async () => {
    ai.completeJson.mockResolvedValue(result({ sentiment: 'negative' }));

    await service.triage('t1');

    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: TicketPriority.HIGH }),
      }),
    );
    expect(notifications.notifyByRole).toHaveBeenCalledWith(
      ['AGENT', 'ADMIN'],
      expect.objectContaining({ title: expect.stringContaining('Eskalasi') }),
    );
  });

  it('escalasi berhenti di URGENT (tidak overflow)', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...baseTicket,
      priority: TicketPriority.URGENT,
    });
    ai.completeJson.mockResolvedValue(
      result({ priority: TicketPriority.URGENT, sentiment: 'negative' }),
    );

    await service.triage('t1');

    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: TicketPriority.URGENT }),
      }),
    );
  });

  it('slug kategori tidak valid dari LLM → kategori lama dipertahankan', async () => {
    ai.completeJson.mockResolvedValue(result({ categorySlug: 'ngawur' }));

    await service.triage('t1');

    const updateArgs = prisma.ticket.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs.data.categoryId).toBeUndefined();
    expect(updateArgs.data.aiTriaged).toBe(true);
  });

  it('prioritas tidak valid dari LLM → pakai prioritas tiket saat ini', async () => {
    ai.completeJson.mockResolvedValue(
      result({ priority: 'GINA' as unknown as TicketPriority }),
    );

    await service.triage('t1');

    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: TicketPriority.MEDIUM }),
      }),
    );
  });

  it('tiket sudah pernah triage → dilewati', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...baseTicket,
      aiTriaged: true,
    });

    const out = await service.triage('t1');

    expect(out.updated).toBe(false);
    expect(ai.completeJson).not.toHaveBeenCalled();
  });

  it('tiket tidak ada → NotFoundException', async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);

    await expect(service.triage('t-404')).rejects.toThrow(NotFoundException);
  });

  it('LLM error → rethrow supaya retry queue bekerja', async () => {
    ai.completeJson.mockRejectedValue(new Error('API down'));

    await expect(service.triage('t1')).rejects.toThrow('API down');
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });
});
