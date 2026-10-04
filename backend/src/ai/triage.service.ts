import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, Role, TicketPriority } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';

export interface TriageResult {
  categorySlug: string;
  priority: TicketPriority;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  reason: string;
}

const PRIORITY_ORDER: TicketPriority[] = [
  TicketPriority.LOW,
  TicketPriority.MEDIUM,
  TicketPriority.HIGH,
  TicketPriority.URGENT,
];

const SENTIMENT_ESCALATION = new Set(['negative']);

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * A-2: Klasifikasi otomatis kategori + prioritas + sentimen saat tiket baru.
   * - kategori disesuaikan jika LLM yakin dan slug valid
   * - sentimen negatif (user frustrasi) → prioritas dinaikkan 1 tingkat
   * - hasil disimpan ke aiTriaged / aiSentiment / aiConfidence
   */
  async triage(
    ticketId: string,
  ): Promise<{ updated: boolean; reason: string }> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException(`Tiket ${ticketId} tidak ditemukan`);
    }
    if (ticket.aiTriaged) {
      return { updated: false, reason: 'sudah pernah triage' };
    }

    const categories = await this.prisma.category.findMany({
      select: { slug: true, name: true, description: true },
    });

    const system =
      'Kamu adalah triage bot IT help desk. Jawab HANYA dengan JSON valid tanpa teks lain.';
    const prompt = [
      'Klasifikasi tiket berikut.',
      `Judul: ${ticket.title}`,
      `Deskripsi: ${ticket.description}`,
      `Prioritas saat ini: ${ticket.priority}`,
      '',
      'Kategori yang tersedia:',
      ...categories.map((c) => `- ${c.slug}: ${c.name}`),
      '',
      'Balas JSON dengan skema:',
      '{"categorySlug":"<salah satu slug>","priority":"LOW|MEDIUM|HIGH|URGENT","sentiment":"positive|neutral|negative","confidence":0.0-1.0,"reason":"<alasan singkat>"}',
      'Aturan: priority = seberapa mendesak tiket ini SEBELUM mempertimbangkan sentimen.',
      'Sentiment = emosi yang dirasakan user (frustrasi/marah = negative).',
    ].join('\n');

    let result: TriageResult;
    try {
      result = await this.ai.completeJson<TriageResult>({ system, prompt });
    } catch (err) {
      this.logger.warn(
        `Triage gagal untuk ${ticket.code}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err; // biar retry queue bekerja; tiket tetap bisa dibuat tanpa AI
    }

    // --- Validasi hasil LLM ---
    const validCategory = categories.find(
      (c) => c.slug === result.categorySlug,
    );
    const validPriority = PRIORITY_ORDER.includes(result.priority)
      ? result.priority
      : ticket.priority;
    const sentiment = (['positive', 'neutral', 'negative'] as const).includes(
      result.sentiment,
    )
      ? result.sentiment
      : 'neutral';

    // --- Eskalasi prioritas jika user frustrasi (sentimen negatif) ---
    let priority = validPriority;
    let escalated = false;
    if (SENTIMENT_ESCALATION.has(sentiment)) {
      const idx = PRIORITY_ORDER.indexOf(priority);
      if (idx < PRIORITY_ORDER.length - 1) {
        priority = PRIORITY_ORDER[idx + 1];
        escalated = true;
      }
    }

    const resolvedCategoryId = validCategory
      ? ((await this.resolveCategoryId(validCategory.slug)) ?? undefined)
      : undefined;

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        ...(resolvedCategoryId ? { categoryId: resolvedCategoryId } : {}),
        priority,
        aiTriaged: true,
        aiSentiment: sentiment,
        aiConfidence:
          typeof result.confidence === 'number'
            ? Math.min(Math.max(result.confidence, 0), 1)
            : null,
      },
    });

    const notes: string[] = [];
    if (resolvedCategoryId && validCategory) {
      notes.push(`kategori=${validCategory.slug}`);
    }
    if (escalated) {
      notes.push(
        `eskalasi ${validPriority}→${priority} (sentimen ${sentiment})`,
      );
      // Beri tahu agen ada eskalasi
      await this.notifications.notifyByRole([Role.AGENT, Role.ADMIN], {
        type: NotificationType.GENERAL,
        title: `Eskalasi prioritas: ${ticket.code}`,
        body: `AI menaikkan prioritas ke ${priority} karena sentimen user (${sentiment}).`,
        ticketId: ticket.id,
      });
    }
    notes.push(`sentimen=${sentiment}`);

    this.logger.log(
      `Triage ${ticket.code}: ${notes.join(', ')} (confidence=${result.confidence ?? '?'})`,
    );
    return { updated: true, reason: notes.join(', ') };
  }

  private async resolveCategoryId(slug: string): Promise<string | undefined> {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    return category?.id;
  }
}
