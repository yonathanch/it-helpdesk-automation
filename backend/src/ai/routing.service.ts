import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, Role, TicketStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export interface RoutingResult {
  assigned: boolean;
  assigneeId?: string;
  assigneeName?: string;
  reason: string;
}

/** Status yang dihitung sebagai "beban kerja" agen */
const ACTIVE_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_USER,
];

/**
 * A-6: Auto-routing tiket ke agen.
 * Skor = beban kerja aktif − pengalaman kategori (pengalaman menahan skor).
 * Agen dengan skor terendah menang; tiket selesai/tutup tidak dihitung.
 */
@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async autoAssign(
    ticketId: string,
    opts: { force?: boolean } = {},
  ): Promise<RoutingResult> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Tiket tidak ditemukan');
    }
    if (ticket.assigneeId && !opts.force) {
      return { assigned: false, reason: 'sudah punya agen' };
    }
    if (
      ticket.status === TicketStatus.RESOLVED ||
      ticket.status === TicketStatus.CLOSED
    ) {
      return { assigned: false, reason: `status ${ticket.status}` };
    }

    const agents = await this.prisma.user.findMany({
      where: { role: { in: [Role.AGENT, Role.ADMIN] }, isActive: true },
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    if (agents.length === 0) {
      return { assigned: false, reason: 'tidak ada agen aktif' };
    }

    const scored = await Promise.all(
      agents.map(async (agent) => {
        const workload = await this.prisma.ticket.count({
          where: {
            assigneeId: agent.id,
            status: { in: ACTIVE_STATUSES },
          },
        });
        const categoryExperience = await this.prisma.ticket.count({
          where: { assigneeId: agent.id, categoryId: ticket.categoryId },
        });
        return { ...agent, workload, categoryExperience };
      }),
    );

    // Skor terendah menang: beban aktif dikurangi pengalaman kategori
    scored.sort(
      (a, b) =>
        a.workload -
          a.categoryExperience -
          (b.workload - b.categoryExperience) ||
        a.workload - b.workload ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const best = scored[0];

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { assigneeId: best.id },
    });

    await this.notifications.notify(best.id, {
      type: NotificationType.TICKET_ASSIGNED,
      title: `Tiket ${ticket.code} ditugaskan otomatis ke kamu`,
      body: `${ticket.title} (skor: beban ${best.workload}, pengalaman kategori ${best.categoryExperience})`,
      ticketId: ticket.id,
    });

    this.logger.log(
      `Auto-routing ${ticket.code} → ${best.name} (beban=${best.workload}, exp=${best.categoryExperience})`,
    );
    return {
      assigned: true,
      assigneeId: best.id,
      assigneeName: best.name,
      reason: `beban=${best.workload}, pengalaman kategori=${best.categoryExperience}`,
    };
  }
}
