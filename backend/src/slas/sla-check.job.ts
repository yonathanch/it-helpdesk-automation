import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, Role, TicketStatus } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Job periodik (tiap 60 detik via Redis/BullMQ):
 * tandai tiket yang melewati slaDueAt tapi belum RESOLVED/CLOSED → slaBreachedAt,
 * lalu kirim notifikasi + email ke penanggung jawab.
 */
@Injectable()
export class SlaCheckJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaCheckJob.name);
  private readonly queue: Queue;
  private readonly worker: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    config: ConfigService,
  ) {
    const connection = {
      host: config.get<string>('REDIS_HOST') ?? 'localhost',
      port: Number.parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10),
      maxRetriesPerRequest: null,
    };

    this.queue = new Queue('sla-check', { connection });
    this.worker = new Worker('sla-check', async () => this.runCheck(), {
      connection,
    });

    this.worker.on('completed', (job) =>
      this.logger.debug(`SLA check ${job.id} selesai`),
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`SLA check ${job?.id} gagal: ${err.message}`),
    );
  }

  async onModuleInit() {
    // Job scheduler berjalan terus selama aplikasi hidup (tiap 60 detik)
    await this.queue.upsertJobScheduler('sla-check-every-minute', {
      every: 60_000,
    });
    this.logger.log('Scheduler SLA breach aktif (tiap 60 detik)');
  }

  /** Inti logika — dipanggil worker dan bisa diuji langsung */
  async runCheck(): Promise<{ breached: number }> {
    const now = new Date();

    const tickets = await this.prisma.ticket.findMany({
      where: {
        slaDueAt: { lt: now },
        slaBreachedAt: null,
        status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
      },
      include: { category: { select: { name: true } } },
    });

    for (const ticket of tickets) {
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { slaBreachedAt: now },
      });

      const title = `SLA terlewati: ${ticket.code}`;
      const body = `Tiket "${ticket.title}" melewati batas SLA (prioritas ${ticket.priority}) dan belum selesai.`;

      if (ticket.assigneeId) {
        await this.notifications.notify(ticket.assigneeId, {
          type: NotificationType.SLA_BREACH,
          title,
          body,
          ticketId: ticket.id,
        });
      } else {
        // belum ada agen — beri tahu semua agen/admin
        await this.notifications.notifyByRole([Role.AGENT, Role.ADMIN], {
          type: NotificationType.SLA_BREACH,
          title,
          body,
          ticketId: ticket.id,
        });
      }
      this.logger.warn(`SLA BREACH: ${ticket.code} (${ticket.priority})`);
    }

    return { breached: tickets.length };
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
  }
}
