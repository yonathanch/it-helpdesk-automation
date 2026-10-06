import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import type { TicketPriority, TicketStatus } from '@prisma/client';

export type WebhookKind = 'slack' | 'teams' | 'whatsapp';

export interface WebhookJob {
  kind: WebhookKind;
  event: string;
  text: string;
  ticketCode: string;
  ticketUrl?: string;
  priority: TicketPriority;
  status?: TicketStatus;
}

interface WebhookTarget {
  kind: WebhookKind;
  url: string;
}

/**
 * Subset field tiket yang dibutuhkan webhook.
 *
 * Sengaja memakai bentuk longgar (`slaDueAt` bisa Date atau null) supaya
 * objek Prisma yang sudah `include` bisa langsung diteruskan tanpa
 * pemetaan ulang di setiap titik pemanggilan.
 */
export interface TicketRef {
  code: string;
  title: string;
  priority: TicketPriority;
}

/**
 * Notifikasi ke kanal eksternal (Slack / Microsoft Teams / WhatsApp).
 *
 * - Format pesan menyesuaikan jenis kanal (Slack & Teams pakai payload JSON,
 *   WhatsApp Business Cloud API memakai JSON sederhana).
 * - Pengiriman lewat antrean BullMQ supaya request HTTP tidak ikut menunggu.
 * - Kegagalan webhook TIDAK boleh menggagalkan operasi bisnis (mis. saat
 *   membuat tiket), jadi error hanya dicatat ke log.
 */
@Injectable()
export class WebhooksService implements OnModuleDestroy {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly queue: Queue<WebhookJob>;
  private readonly targets: WebhookTarget[] = [];

  constructor(config: ConfigService) {
    this.queue = new Queue<WebhookJob>('webhook', {
      connection: {
        host: config.get<string>('REDIS_HOST') ?? 'localhost',
        port: Number.parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10),
        maxRetriesPerRequest: null,
      },
    });

    // URL webhook dibaca dari env. Kosong = kanal dimatikan.
    const slack = config.get<string>('WEBHOOK_SLACK_URL')?.trim();
    const teams = config.get<string>('WEBHOOK_TEAMS_URL')?.trim();
    const whatsapp = config.get<string>('WEBHOOK_WHATSAPP_URL')?.trim();

    if (slack) this.targets.push({ kind: 'slack', url: slack });
    if (teams) this.targets.push({ kind: 'teams', url: teams });
    if (whatsapp) this.targets.push({ kind: 'whatsapp', url: whatsapp });

    if (this.targets.length === 0) {
      this.logger.warn(
        'Tidak ada WEBHOOK_*_URL yang di-set — notifikasi eksternal dimatikan',
      );
    } else {
      this.logger.log(
        `Webhook aktif untuk: ${this.targets.map((t) => t.kind).join(', ')}`,
      );
    }
  }

  /** publicly: apakah ada kanal yang dikonfigurasi */
  get enabled(): boolean {
    return this.targets.length > 0;
  }

  /** Tiket baru dibuat */
  ticketCreated(ticket: TicketRef) {
    return this.enqueue(
      'ticket_created',
      this.ticketLine('Tiket baru', ticket),
      ticket,
    );
  }

  /** Tiket ditugaskan ke agen */
  ticketAssigned(ticket: TicketRef, assigneeName: string) {
    return this.enqueue(
      'ticket_assigned',
      this.ticketLine(`Tiket ditugaskan ke ${assigneeName}`, ticket),
      ticket,
    );
  }

  /** Status tiket berubah */
  ticketStatusChanged(ticket: TicketRef & { status: TicketStatus }) {
    return this.enqueue(
      'ticket_status_changed',
      this.ticketLine('Status tiket berubah', ticket),
      ticket,
    );
  }

  /** SLA terlampaui */
  slaBreached(ticket: TicketRef & { slaDueAt: Date | null }) {
    const due = ticket.slaDueAt
      ? new Date(ticket.slaDueAt).toISOString()
      : 'tidak diketahui';
    return this.enqueue(
      'sla_breached',
      `⚠️ SLA terlampaui — ${ticket.code} — ${ticket.title}\nBatas SLA: ${due}`,
      ticket,
    );
  }

  private ticketLine(prefix: string, ticket: TicketRef) {
    return `${prefix} — ${ticket.code} — ${ticket.title}\nPrioritas: ${ticket.priority}`;
  }

  /** Masukkan ke antrean; kegagalan enqueue tidak boleh menggagalkan bisnis */
  private async enqueue(
    event: WebhookJob['event'],
    text: string,
    ticket: TicketRef & { status?: TicketStatus },
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.queue.add(
        event,
        {
          kind: this.targets[0].kind,
          event,
          text,
          ticketCode: ticket.code,
          priority: ticket.priority,
          status: ticket.status,
        },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );
    } catch (error) {
      this.logger.warn(
        `Gagal masukkan webhook ke antrean: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
