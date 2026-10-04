import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role, TicketPriority, TicketStatus } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets.query.dto';

describe('TicketsService', () => {
  let service: TicketsService;

  const storage = {
    upload: jest.fn().mockResolvedValue(undefined),
    download: jest.fn(),
  };

  const prisma = {
    category: { findUnique: jest.fn() },
    sla: { findUnique: jest.fn() },
    ticket: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    ticketMessage: { create: jest.fn() },
    attachment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const agent = { sub: 'agent-1', email: 'a@x.com', role: Role.AGENT };
  const endUser = { sub: 'user-1', email: 'u@x.com', role: Role.END_USER };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TicketsService(prisma as never, storage as never);
  });

  describe('create', () => {
    const dto: CreateTicketDto = {
      title: 'Laptop mati',
      description: 'Laptop tidak bisa dinyalakan',
      categoryId: 'cat-1',
      priority: TicketPriority.HIGH,
    };

    it('membuat tiket dengan kode unik dan SLA deadline', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.sla.findUnique.mockResolvedValue({ resolutionMinutes: 480 });
      prisma.$queryRaw.mockResolvedValue([{ nextval: BigInt(1) }]);
      prisma.ticket.create.mockResolvedValue({ id: 't1', code: 'HD-0001' });

      const result = await service.create(dto, endUser);

      expect(result.code).toBe('HD-0001');
      expect(prisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requesterId: 'user-1',
            priority: TicketPriority.HIGH,
            slaDueAt: expect.any(Date),
          }),
        }),
      );
    });

    it('menolak kategori yang tidak ada', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, endUser)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.ticket.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('END_USER SELALU dibatasi ke tiketnya sendiri walau scope=all', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);
      const query = { scope: 'all' } as ListTicketsQueryDto;

      await service.findAll(query, endUser);

      const where = (
        prisma.ticket.findMany.mock.calls[0][0] as {
          where: Record<string, unknown>;
        }
      ).where;
      expect(where.requesterId).toBe('user-1');
      expect(where.assigneeId).toBeUndefined();
    });

    it('AGENT dengan scope=unassigned hanya melihat tiket tanpa agen', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);
      const query = { scope: 'unassigned' } as ListTicketsQueryDto;

      await service.findAll(query, agent);

      const where = (
        prisma.ticket.findMany.mock.calls[0][0] as {
          where: Record<string, unknown>;
        }
      ).where;
      expect(where.assigneeId).toBeNull();
      expect(where.requesterId).toBeUndefined();
    });

    it('mengembalikan meta pagination', async () => {
      prisma.ticket.findMany.mockResolvedValue([{}, {}]);
      prisma.ticket.count.mockResolvedValue(42);

      const result = await service.findAll({ page: 2, limit: 20 }, agent);

      expect(result.meta).toEqual({
        page: 2,
        limit: 20,
        total: 42,
        totalPages: 3,
      });
    });
  });

  describe('updateStatus', () => {
    it('menolak END_USER mengubah status (Forbidden)', async () => {
      await expect(
        service.updateStatus('t1', { status: TicketStatus.CLOSED }, endUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('menolak transisi yang tidak diizinkan', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't1',
        status: TicketStatus.CLOSED,
      });

      await expect(
        service.updateStatus('t1', { status: TicketStatus.OPEN }, agent),
      ).rejects.toThrow(BadRequestException);
    });

    it('mengizinkan transisi OPEN → IN_PROGRESS dan mengisi firstReplyAt', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't1',
        status: TicketStatus.OPEN,
        resolvedAt: null,
        closedAt: null,
        firstReplyAt: null,
      });
      prisma.ticket.update.mockResolvedValue({
        id: 't1',
        status: TicketStatus.IN_PROGRESS,
      });

      await service.updateStatus(
        't1',
        { status: TicketStatus.IN_PROGRESS },
        agent,
      );

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TicketStatus.IN_PROGRESS,
            firstReplyAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('assign', () => {
    it('menolak assign ke user berrole END_USER', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't1',
        status: TicketStatus.OPEN,
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        role: Role.END_USER,
        isActive: true,
      });

      await expect(service.assign('t1', 'u2', agent)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('berhasil assign ke agen dan status OPEN → IN_PROGRESS', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't1',
        status: TicketStatus.OPEN,
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        role: Role.AGENT,
        isActive: true,
      });
      prisma.ticket.update.mockResolvedValue({ id: 't1', assigneeId: 'u2' });

      await service.assign('t1', 'u2', agent);

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assigneeId: 'u2',
            status: TicketStatus.IN_PROGRESS,
          }),
        }),
      );
    });
  });

  describe('addMessage (B-5)', () => {
    it('menolak END_USER membuat catatan internal', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't1',
        requesterId: 'user-1',
      });

      await expect(
        service.addMessage(
          't1',
          { content: 'catatan', isInternal: true },
          endUser,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.ticketMessage.create).not.toHaveBeenCalled();
    });

    it('END_USER hanya bisa menulis di tiketnya sendiri', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't1',
        requesterId: 'user-lain',
      });

      await expect(
        service.addMessage('t1', { content: 'halo' }, endUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('agen bisa membuat catatan internal', async () => {
      prisma.ticket.findUnique.mockResolvedValue({ id: 't1' });
      prisma.ticketMessage.create.mockResolvedValue({
        id: 'm1',
        isInternal: true,
      });

      const result = await service.addMessage(
        't1',
        { content: 'internal note', isInternal: true },
        agent,
      );

      expect(result.isInternal).toBe(true);
      expect(prisma.ticketMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isInternal: true,
            authorId: 'agent-1',
          }),
        }),
      );
    });
  });

  describe('attachments (B-5)', () => {
    const file = {
      originalname: 'laporan akhir.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('dummy'),
    };

    it('upload: simpan ke MinIO lalu buat row di database', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't1',
        requesterId: 'user-1',
      });
      prisma.attachment.create.mockResolvedValue({ id: 'a1' });

      await service.addAttachment('t1', file, endUser);

      expect(storage.upload).toHaveBeenCalledWith(
        expect.stringContaining('tickets/t1/'),
        file.buffer,
        'application/pdf',
      );
      expect(prisma.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            filename: 'laporan akhir.pdf',
            ticketId: 't1',
            uploaderId: 'user-1',
          }),
        }),
      );
    });

    it('menolak akses lampiran milik tiket orang lain', async () => {
      prisma.attachment.findUnique.mockResolvedValue({
        id: 'a1',
        key: 'k',
        ticketId: 't1',
        filename: 'x.pdf',
        mimeType: 'application/pdf',
      });
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't1',
        requesterId: 'user-lain',
      });

      await expect(service.downloadAttachment('a1', endUser)).rejects.toThrow(
        NotFoundException,
      );
      expect(storage.download).not.toHaveBeenCalled();
    });
  });
});
