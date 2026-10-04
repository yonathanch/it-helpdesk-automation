import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role, TicketStatus } from '@prisma/client';
import { DraftService } from './draft.service';

describe('A-5: DraftService', () => {
  let service: DraftService;

  const prisma = {
    ticket: { findUnique: jest.fn(), update: jest.fn() },
    ticketMessage: { create: jest.fn() },
  };
  const ai = { completeJson: jest.fn() };
  const knowledge = { search: jest.fn() };

  const agent = { sub: 'a1', email: 'a@x.com', role: Role.AGENT };
  const endUser = { sub: 'u1', email: 'u@x.com', role: Role.END_USER };

  const ticket = {
    id: 't1',
    code: 'HD-0001',
    title: 'VPN tidak bisa connect',
    description: 'error sejak pagi',
    status: TicketStatus.OPEN,
    priority: 'MEDIUM',
    aiDraft: null as string | null,
    category: { name: 'Network' },
    messages: [
      {
        content: 'vpn error',
        isInternal: false,
        author: { name: 'User', role: Role.END_USER },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DraftService(
      prisma as never,
      ai as never,
      knowledge as never,
    );
    prisma.ticket.findUnique.mockResolvedValue({ ...ticket });
    prisma.ticket.update.mockResolvedValue({ id: 't1' });
    knowledge.search.mockResolvedValue([]);
    ai.completeJson.mockResolvedValue({ draft: 'Draft dari AI.' });
  });

  describe('generate', () => {
    it('menyimpan draft ke ticket.aiDraft (belum terkirim)', async () => {
      const result = await service.generate('t1', agent);

      expect(result.draft).toBe('Draft dari AI.');
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't1' },
          data: expect.objectContaining({
            aiDraft: 'Draft dari AI.',
            aiDraftAt: expect.any(Date),
          }),
        }),
      );
      // tidak ada pesan yang dibuat saat generate
      expect(prisma.ticketMessage.create).not.toHaveBeenCalled();
    });

    it('END_USER ditolak (Forbidden)', async () => {
      await expect(service.generate('t1', endUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(ai.completeJson).not.toHaveBeenCalled();
    });

    it('tiket tidak ada → NotFoundException', async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(service.generate('t-404', agent)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('RAG gagal → generate tetap jalan tanpa artikel', async () => {
      knowledge.search.mockRejectedValue(new Error('pgvector down'));

      const result = await service.generate('t1', agent);

      expect(result.draft).toBe('Draft dari AI.');
      expect(result.sources).toEqual([]);
    });

    it('AI mengembalikan draft kosong → BadRequestException', async () => {
      ai.completeJson.mockResolvedValue({ draft: '   ' });

      await expect(service.generate('t1', agent)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('approve tanpa konten → kirim draft tersimpan sebagai pesan publik', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        ...ticket,
        aiDraft: 'Draft tersimpan',
      });
      prisma.ticketMessage.create.mockResolvedValue({ id: 'm1' });

      const result = await service.approve('t1', undefined, agent);

      expect(prisma.ticketMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: 'Draft tersimpan',
            isInternal: false,
            isAiGenerated: true,
            authorId: 'a1',
          }),
        }),
      );
      expect(result).toEqual({ id: 'm1' });
      // draft dibersihkan setelah terkirim
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { aiDraft: null, aiDraftAt: null },
        }),
      );
    });

    it('agen mengedit sebelum kirim → konten edit yang dipakai', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        ...ticket,
        aiDraft: 'Draft asli',
      });
      prisma.ticketMessage.create.mockResolvedValue({ id: 'm2' });

      await service.approve('t1', 'Hasil edit agen', agent);

      expect(prisma.ticketMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ content: 'Hasil edit agen' }),
        }),
      );
    });

    it('tidak ada draft dan tidak ada konten → BadRequestException', async () => {
      await expect(service.approve('t1', undefined, agent)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.ticketMessage.create).not.toHaveBeenCalled();
    });

    it('tiket CLOSED → ditolak', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        ...ticket,
        status: TicketStatus.CLOSED,
        aiDraft: 'x',
      });

      await expect(service.approve('t1', undefined, agent)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('END_USER ditolak (Forbidden)', async () => {
      await expect(service.approve('t1', 'isi', endUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('discard', () => {
    it('membuang draft tanpa mengirim', async () => {
      const result = await service.discard('t1', agent);

      expect(result).toEqual({ discarded: true });
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { aiDraft: null, aiDraftAt: null },
        }),
      );
      expect(prisma.ticketMessage.create).not.toHaveBeenCalled();
    });
  });
});
