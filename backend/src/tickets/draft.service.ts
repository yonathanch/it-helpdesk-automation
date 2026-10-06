import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role, TicketStatus } from '@prisma/client';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './tickets.service';
import { ATTACHMENT_SELECT } from './tickets.service';

export interface DraftResult {
  draft: string;
  sources: {
    id: string;
    title: string;
    slug: string;
    similarity: number;
    content: string;
  }[];
  generatedAt: Date;
}

interface LlmDraftResult {
  draft: string;
}

const DRAFT_CONTEXT_ARTICLES = 3;
const DRAFT_MESSAGES_LIMIT = 20;

/**
 * A-5: Draft reply AI untuk agen.
 * - generate: AI menyusun draf balasan berdasarkan tiket + percakapan + RAG
 *   artikel, disimpan ke ticket.aiDraft (BELUM terkirim).
 * - approve: agen menyetujui / mengedit lalu mengirim sebagai pesan publik
 *   yang ditandai isAiGenerated=true; draf dibersihkan.
 */
@Injectable()
export class DraftService {
  private readonly logger = new Logger(DraftService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly knowledge: KnowledgeService,
  ) {}

  async generate(ticketId: string, user: AuthUser): Promise<DraftResult> {
    this.assertAgentOrAdmin(user);
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        category: { select: { name: true } },
        messages: {
          // 20 pesan terakhir, dibalik ke urutan kronologis untuk prompt
          orderBy: { createdAt: 'desc' },
          take: DRAFT_MESSAGES_LIMIT,
          include: { author: { select: { name: true, role: true } } },
        },
      },
    });
    if (!ticket) {
      throw new NotFoundException('Tiket tidak ditemukan');
    }

    // RAG: artikel relevan dengan masalah di tiket
    let sources: DraftResult['sources'] = [];
    try {
      sources = await this.knowledge.search(
        `${ticket.title} ${ticket.description}`,
        DRAFT_CONTEXT_ARTICLES,
      );
    } catch (err) {
      this.logger.warn(
        `RAG untuk draft gagal: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const system =
      'Kamu adalah agen IT help desk profesional. Tulis balasan yang sopan, ' +
      'jelas, dan solutif dalam bahasa Indonesia. Hanya tulis isi balasan ' +
      '(tanpa subjek email, tanpa basa-basi berlebihan).';
    const prompt = [
      'Tulis draft balasan untuk percakapan tiket berikut.',
      `Judul: ${ticket.title}`,
      `Deskripsi: ${ticket.description}`,
      `Kategori: ${ticket.category?.name ?? '-'}`,
      `Prioritas: ${ticket.priority} | Status: ${ticket.status}`,
      '',
      'Percakapan:',
      ...[...ticket.messages]
        .reverse()
        .map(
          (m) =>
            `[${m.author.name}${m.author.role !== Role.END_USER ? ' (agen)' : ''}]${m.isInternal ? ' [internal]' : ''}: ${m.content}`,
        ),
      sources.length > 0
        ? [
            '',
            'Artikel panduan (boleh dirujuk):',
            ...sources.map((s) => `- ${s.title}: ${s.content.slice(0, 400)}`),
          ].join('\n')
        : '',
      '',
      'Balas JSON dengan skema: {"draft":"<isi balasan>"}',
    ]
      .filter((part) => part !== '')
      .join('\n');

    const result = await this.ai.completeJson<LlmDraftResult>({
      system,
      prompt,
    });
    const draft = typeof result.draft === 'string' ? result.draft.trim() : '';
    if (!draft) {
      throw new BadRequestException('AI tidak menghasilkan draft');
    }

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { aiDraft: draft, aiDraftAt: new Date() },
    });
    this.logger.log(`Draft dibuat untuk ${ticket.code} oleh ${user.email}`);

    return { draft, sources, generatedAt: new Date() };
  }

  /** Agen approve (tanpa edit) atau edit dulu lalu kirim — content = isi final */
  async approve(ticketId: string, content: string | undefined, user: AuthUser) {
    this.assertAgentOrAdmin(user);
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Tiket tidak ditemukan');
    }
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Tiket sudah ditutup');
    }

    const finalContent = (content ?? ticket.aiDraft ?? '').trim();
    if (!finalContent) {
      throw new BadRequestException(
        'Tidak ada draft untuk dikirim — generate draft dulu atau isi konten',
      );
    }

    const message = await this.prisma.ticketMessage.create({
      data: {
        content: finalContent,
        isInternal: false,
        isAiGenerated: true,
        ticketId: ticket.id,
        authorId: user.sub,
      },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } },
        // Selalu sertakan `attachments` (bisa kosong) supaya bentuk pesan
        // hasil approve sama dengan TicketMessageDto.
        attachments: { select: ATTACHMENT_SELECT },
      },
    });

    // draf terkirim → bersihkan
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { aiDraft: null, aiDraftAt: null },
    });

    this.logger.log(
      `Draft di-approve & dikirim ke ${ticket.code} oleh ${user.email}`,
    );
    return message;
  }

  /** Buang draf tanpa mengirim */
  async discard(ticketId: string, user: AuthUser) {
    this.assertAgentOrAdmin(user);
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Tiket tidak ditemukan');
    }
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { aiDraft: null, aiDraftAt: null },
    });
    return { discarded: true };
  }

  private assertAgentOrAdmin(user: AuthUser) {
    if (user.role !== Role.AGENT && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Hanya agen/admin yang bisa memakai draft AI',
      );
    }
  }
}
