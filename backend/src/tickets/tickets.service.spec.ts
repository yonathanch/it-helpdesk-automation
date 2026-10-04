import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role, TicketPriority, TicketStatus } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets.query.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

describe('TicketsService', () => {
  let service: TicketsService;

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
    user: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const agent = { sub: 'agent-1', email: 'a@x.com', role: Role.AGENT };
  const endUser = { sub: 'user-1', email: 'u@x.com', role: Role.END_USER };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TicketsService(prisma as never);
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

      const where = (prisma.ticket.findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
      expect(where.requesterId).toBe('user-1');
      expect(where.assigneeId).toBeUndefined();
    });

    it('AGENT dengan scope=unassigned hanya melihat tiket tanpa agen', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);
      const query = { scope: 'unassigned' } as ListTicketsQueryDto;

      await service.findAll(query, agent);

      const where = (prisma.ticket.findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
      expect(where.assigneeId).toBeNull();
      expect(where.requesterId).toBeUndefined();
    });

    it('mengembalikan meta pagination', async () => {
      prisma.ticket.findMany.mockResolvedValue([{}, {}]);
      prisma.ticket.count.mockResolvedValue(42);

      const result = await service.findAll(
        { page: 2, limit: 20 } as ListTicketsQueryDto,
        agent,
      );

      expect(result.meta).toEqual({ page: 2, limit: 20, total: 42, totalPages: 3 });
    });
  });

  describe('updateStatus', () => {
    it('menolak END_USER mengubah status (Forbidden)', async () => {
      await expect(
        service.updateStatus('t1', { status: TicketStatus.CLOSED } as UpdateStatusDto, endUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('menolak transisi yang tidak diizinkan', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't1',
        status: TicketStatus.CLOSED,
      });

      await expect(
        service.updateStatus('t1', { status: TicketStatus.OPEN } as UpdateStatusDto, agent),
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
      prisma.ticket.update.mockResolvedValue({ id: 't1', status: TicketStatus.IN_PROGRESS });

      await service.updateStatus(
        't1',
        { status: TicketStatus.IN_PROGRESS } as UpdateStatusDto,
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
      prisma.ticket.findUnique.mockResolvedValue({ id: 't1', status: TicketStatus.OPEN });
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
});
