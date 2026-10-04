import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, TicketPriority, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets.query.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

export interface AuthUser {
  sub: string;
  email: string;
  role: Role;
}

/** Aturan transisi status tiket */
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.WAITING_USER,
    TicketStatus.CLOSED,
  ],
  IN_PROGRESS: [
    TicketStatus.OPEN,
    TicketStatus.WAITING_USER,
    TicketStatus.RESOLVED,
  ],
  WAITING_USER: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  RESOLVED: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS], // IN_PROGRESS = reopen
  CLOSED: [], // final
};

const TICKET_INCLUDE: Prisma.TicketInclude = {
  category: { select: { id: true, name: true, slug: true } },
  requester: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
};

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTicketDto, user: AuthUser) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan');
    }

    const priority = dto.priority ?? TicketPriority.MEDIUM;

    // Deadline SLA dari tabel slas sesuai prioritas
    const sla = await this.prisma.sla.findUnique({ where: { priority } });
    const slaDueAt = sla
      ? new Date(Date.now() + sla.resolutionMinutes * 60_000)
      : null;

    const code = await this.generateCode();

    const ticket = await this.prisma.ticket.create({
      data: {
        code,
        title: dto.title,
        description: dto.description,
        priority,
        categoryId: dto.categoryId,
        requesterId: user.sub,
        slaDueAt,
      },
      include: TICKET_INCLUDE,
    });

    return ticket;
  }

  async findAll(query: ListTicketsQueryDto, user: AuthUser) {
    const where: Prisma.TicketWhereInput = {};

    // RBAC scoping: END_USER hanya melihat tiketnya sendiri
    if (user.role === Role.END_USER) {
      where.requesterId = user.sub;
    } else if (query.scope === 'mine') {
      where.assigneeId = user.sub;
    } else if (query.scope === 'unassigned') {
      where.assigneeId = null;
    }

    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: TICKET_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        ...TICKET_INCLUDE,
        messages: {
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) {
      throw new NotFoundException('Tiket tidak ditemukan');
    }

    if (user.role === Role.END_USER && ticket.requesterId !== user.sub) {
      throw new NotFoundException('Tiket tidak ditemukan'); // jangan bocorkan keberadaan tiket orang lain
    }
    return ticket;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, user: AuthUser) {
    this.assertAgentOrAdmin(
      user,
      'Hanya agen/admin yang bisa mengubah status tiket',
    );

    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException('Tiket tidak ditemukan');
    }

    const allowed = ALLOWED_TRANSITIONS[ticket.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transisi status tidak valid: ${ticket.status} → ${dto.status}. Yang diizinkan: ${allowed.join(', ') || '(tidak ada)'}`,
      );
    }

    return this.prisma.ticket.update({
      where: { id },
      data: {
        status: dto.status,
        resolvedAt:
          dto.status === TicketStatus.RESOLVED
            ? new Date()
            : dto.status === TicketStatus.IN_PROGRESS && ticket.resolvedAt
              ? null // reopen
              : ticket.resolvedAt,
        closedAt:
          dto.status === TicketStatus.CLOSED ? new Date() : ticket.closedAt,
        firstReplyAt: ticket.firstReplyAt ?? new Date(),
      },
      include: TICKET_INCLUDE,
    });
  }

  async assign(id: string, assigneeId: string, user: AuthUser) {
    this.assertAgentOrAdmin(user, 'Hanya agen/admin yang bisa assign tiket');

    const [ticket, assignee] = await Promise.all([
      this.prisma.ticket.findUnique({ where: { id } }),
      this.prisma.user.findUnique({ where: { id: assigneeId } }),
    ]);
    if (!ticket) {
      throw new NotFoundException('Tiket tidak ditemukan');
    }
    if (!assignee || !assignee.isActive) {
      throw new NotFoundException('Agen tidak ditemukan atau nonaktif');
    }
    if (assignee.role !== Role.AGENT && assignee.role !== Role.ADMIN) {
      throw new BadRequestException(
        'Tiket hanya bisa di-assign ke AGENT atau ADMIN',
      );
    }

    return this.prisma.ticket.update({
      where: { id },
      data: {
        assigneeId,
        // assign = mulai dikerjakan
        status:
          ticket.status === TicketStatus.OPEN
            ? TicketStatus.IN_PROGRESS
            : ticket.status,
      },
      include: TICKET_INCLUDE,
    });
  }

  private assertAgentOrAdmin(user: AuthUser, message: string) {
    if (user.role !== Role.AGENT && user.role !== Role.ADMIN) {
      throw new ForbiddenException(message);
    }
  }

  /** Nomor tiket unik HD-0001 via sequence Postgres (aman dari race) */
  private async generateCode(): Promise<string> {
    const rows = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval('ticket_code_seq')
    `;
    return `HD-${String(rows[0].nextval).padStart(4, '0')}`;
  }
}
