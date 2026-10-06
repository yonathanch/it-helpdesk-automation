import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import type { WebhookJob, WebhookKind } from './webhooks.service';

/**
 * Worker webhook berjalan di antrean Redis `webhook`.
 *
 * Format payload mengikuti masing-masing kanal:
 * - Slack    → `{ text }` (Incoming Webhook)
 * - Teams    → MessageCard `{ @type, text }` (Office 365 connector)
 * - WhatsApp → WhatsApp Business Cloud API `{ messaging_product, to, text }`
 */
@Injectable()
export class WebhookWorker implements OnModuleDestroy {
  private readonly logger = new Logger(WebhookWorker.name);
  private worker?: Worker<WebhookJob>;

  private readonly urls: Partial<Record<WebhookKind, string>> = {};

  constructor(config: ConfigService) {
    const slack = config.get<string>('WEBHOOK_SLACK_URL')?.trim();
    const teams = config.get<string>('WEBHOOK_TEAMS_URL')?.trim();
    const whatsapp = config.get<string>('WEBHOOK_WHATSAPP_URL')?.trim();
    if (slack) this.urls.slack = slack;
    if (teams) this.urls.teams = teams;
    if (whatsapp) this.urls.whatsapp = whatsapp;

    // Nomor penerima WhatsApp (format E.164, mis. 6281234567890)
    this.whatsappTo = config.get<string>('WHATSAPP_TO')?.trim() ?? '';

    this.worker = new Worker<WebhookJob>(
      'webhook',
      (job) => this.handle(job.data),
      {
        connection: {
          host: config.get<string>('REDIS_HOST') ?? 'localhost',
          port: Number.parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10),
          maxRetriesPerRequest: null,
        },
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Webhook ${job?.name ?? '?'} gagal: ${err.message}`);
    });
  }

  private readonly whatsappTo: string;

  /** Kirim ke semua kanal yang dikonfigurasi; satu kanal gagal tidak menghalangi yang lain */
  private async handle(data: WebhookJob): Promise<void> {
    const kinds = Object.keys(this.urls) as WebhookKind[];

    if (kinds.length === 0) {
      this.logger.warn('Tidak ada webhook yang dikonfigurasi — dilewati');
      return;
    }

    await Promise.all(
      kinds.map(async (kind) => {
        const url = this.urls[kind];
        if (!url) return;
        try {
          await this.send(kind, url, data);
          this.logger.log(`Webhook ${kind} terkirim untuk ${data.ticketCode}`);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          // Jangan pernah log URL — bisa memuat token rahasia.
          this.logger.warn(`Webhook ${kind} gagal: ${message}`);
          throw error;
        }
      }),
    );
  }

  private async send(
    kind: WebhookKind,
    url: string,
    data: WebhookJob,
  ): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.buildPayload(kind, data)),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${body.slice(0, 200)}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildPayload(kind: WebhookKind, data: WebhookJob): unknown {
    const text = this.decorate(data);

    switch (kind) {
      case 'slack':
        return { text };

      case 'teams':
        return {
          '@type': 'MessageCard',
          '@context': 'https://schema.org/extensions',
          summary: data.event,
          title: `[IT Help Desk] ${data.ticketCode}`,
          text,
        };

      case 'whatsapp':
        return {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.whatsappTo,
          type: 'text',
          text: { preview_url: false, body: text },
        };
    }
  }

  /** Tambahkan konteks prioritas/status agar pesan webhook informatif */
  private decorate(data: WebhookJob): string {
    const parts = [data.text];
    if (data.status) parts.push(`Status: ${data.status}`);
    parts.push(`Event: ${data.event}`);
    return parts.join('\n');
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
