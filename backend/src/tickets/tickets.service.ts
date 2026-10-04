import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  Role,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { AiService } from '../ai/ai.service';
import { RoutingService } from '../ai/routing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateMessageDto } from './dto/create-message.dto';
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
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly ai: AiService,
    private readonly routing: RoutingService,
  ) {}

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

    // B-7: beri tahu semua agen/admin ada tiket baru
    await this.notifications.notifyByRole([Role.AGENT, Role.ADMIN], {
      type: NotificationType.TICKET_CREATED,
      title: `Tiket baru ${ticket.code}`,
      body: `${ticket.title} (prioritas ${ticket.priority})`,
      ticketId: ticket.id,
    });
    // konfirmasi ke requester (in-app + email queue)
    await this.notifications.notify(user.sub, {
      type: NotificationType.TICKET_CREATED,
      title: `Tiket ${ticket.code} diterima`,
      body: 'Tiket kamu sudah masuk ke antrian IT Help Desk.',
      ticketId: ticket.id,
    });

    // A-2: AI triage dijalankan di background (queue Redis)
    // A-6: jika queue down, tetap auto-routing langsung (fallback)
    try {
      await this.ai.enqueueTriage(ticket.id);
    } catch {
      // Redis/queue down tidak boleh menggagalkan pembuatan tiket
      this.logger.warn(`Gagal antrikan triage untuk ${ticket.code}`);
      try {
        await this.routing.autoAssign(ticket.id);
      } catch (err) {
        this.logger.warn(
          `Auto-routing fallback gagal: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

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
          // END_USER tidak boleh melihat catatan internal agen
          where: user.role === Role.END_USER ? { isInternal: false } : {},
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            size: true,
            createdAt: true,
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

    return this.prisma.ticket
      .update({
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
      })
      .then(async (updated) => {
        // B-7: kabari requester (kecuali dialah yang ubah status)
        if (ticket.requesterId !== user.sub) {
          await this.notifications.notify(ticket.requesterId, {
            type: NotificationType.TICKET_STATUS_CHANGED,
            title: `Tiket ${updated.code}: ${dto.status}`,
            body: updated.title,
            ticketId: updated.id,
          });
        }
        return updated;
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

    return this.prisma.ticket
      .update({
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
      })
      .then(async (updated) => {
        // B-7: beri tahu agen yang ditugaskan
        await this.notifications.notify(assigneeId, {
          type: NotificationType.TICKET_ASSIGNED,
          title: `Tiket ${updated.code} ditugaskan ke kamu`,
          body: updated.title,
          ticketId: updated.id,
        });
        return updated;
      });
  }

  // ============ B-5: Percakapan & Lampiran ============

  async addMessage(ticketId: string, dto: CreateMessageDto, user: AuthUser) {
    const ticket = await this.getTicketWithAccess(ticketId, user);

    const isInternal = dto.isInternal ?? false;
    if (isInternal && user.role === Role.END_USER) {
      throw new ForbiddenException(
        'Catatan internal hanya bisa dibuat agen/admin',
      );
    }

    return this.prisma.ticketMessage.create({
      data: {
        content: dto.content,
        isInternal,
        ticketId: ticket.id,
        authorId: user.sub,
      },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  async addAttachment(
    ticketId: string,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    user: AuthUser,
  ) {
    const ticket = await this.getTicketWithAccess(ticketId, user);

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `tickets/${ticket.id}/${randomUUID()}-${safeName}`;
    await this.storage.upload(key, file.buffer, file.mimetype);

    return this.prisma.attachment.create({
      data: {
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        key,
        ticketId: ticket.id,
        uploaderId: user.sub,
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });
  }

  async listAttachments(ticketId: string, user: AuthUser) {
    await this.getTicketWithAccess(ticketId, user);
    return this.prisma.attachment.findMany({
      where: { ticketId },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async downloadAttachment(
    attachmentId: string,
    user: AuthUser,
  ): Promise<{ filename: string; mimeType: string; stream: Readable }> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException('Lampiran tidak ditemukan');
    }

    await this.getTicketWithAccess(attachment.ticketId!, user);
    const stream = await this.storage.download(attachment.key);

    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      stream,
    };
  }

  /** Ambil tiket + pastikan user boleh mengakses (pemilik / agen / admin) */
  private async getTicketWithAccess(ticketId: string, user: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Tiket tidak ditemukan');
    }
    if (user.role === Role.END_USER && ticket.requesterId !== user.sub) {
      throw new NotFoundException('Tiket tidak ditemukan');
    }
    return ticket;
  }

  /** A-6: trigger manual auto-routing (untuk uji / re-route agen) */
  async autoAssign(id: string, user: AuthUser) {
    this.assertAgentOrAdmin(user, 'Hanya agen/admin yang bisa auto-routing');
    return this.routing.autoAssign(id, { force: true });
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
