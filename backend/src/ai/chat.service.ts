import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AiService } from './ai.service';
import { ChatDto, ChatHistoryItemDto } from './dto/chat.dto';

const DEFAULT_MIN_SIMILARITY = 0.1;
const CONTEXT_SNIPPET_LENGTH = 400;

export interface ChatSource {
  id: string;
  title: string;
  slug: string;
  similarity: number;
  /** potongan isi artikel untuk konteks LLM (dipotong, tidak dikirim ke client penuh) */
  content: string;
}

export interface ChatPrefill {
  title: string;
  description: string;
}

export interface ChatResult {
  answer: string;
  sources: ChatSource[];
  /** true = AI tidak yakin → tawarkan user membuat tiket */
  suggestTicket: boolean;
  /** data chat yang bisa dipakai prefill form tiket (hanya saat suggestTicket) */
  prefill: ChatPrefill | null;
  provider: string;
}

interface LlmChatAnswer {
  answer: string;
  confident: boolean;
}

const FALLBACK_ANSWER =
  'Maaf, saya belum menemukan jawaban yang cocok dari basis pengetahuan. ' +
  'Saya bisa bantu buatkan tiket agar agen IT menindaklanjuti — percakapan ini akan otomatis terisi di formulir tiket.';

/**
 * A-4: Chatbot virtual agent.
 * Alur: semantic search (RAG) → LLM menjawab dari konteks → jika tidak
 * yakin/tidak ada konteks, fallback menawarkan pembuatan tiket dengan
 * prefill dari data chat.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly minSimilarity: number;

  constructor(
    config: ConfigService,
    private readonly ai: AiService,
    private readonly knowledge: KnowledgeService,
  ) {
    const configured = Number.parseFloat(
      config.get<string>('CHAT_MIN_SIMILARITY') ?? '',
    );
    this.minSimilarity = Number.isFinite(configured)
      ? configured
      : DEFAULT_MIN_SIMILARITY;
  }

  async chat(dto: ChatDto, userId: string): Promise<ChatResult> {
    const message = dto.message.trim();
    if (!message) {
      throw new BadRequestException('Pesan kosong');
    }
    const history = dto.history ?? [];
    this.logger.log(`Chat dari ${userId}: "${message.slice(0, 60)}"`);

    // 1) RAG: cari artikel relevan
    const relevant = await this.findRelevant(message);

    // 2) Tidak ada konteks melewati ambang → langsung fallback (tanpa LLM)
    if (relevant.length === 0) {
      return this.fallback(history, message, []);
    }

    // 3) LLM menjawab berdasarkan konteks artikel
    try {
      const result = await this.ai.completeJson<LlmChatAnswer>({
        system:
          'Kamu adalah asisten virtual IT help desk. Jawab HANYA dengan JSON valid: ' +
          '{"answer":"<jawaban singkat dalam bahasa Indonesia>","confident":<true|false>}. ' +
          'Set confident=false jika konteks artikel tidak menjawab pertanyaan.',
        prompt: this.buildPrompt(message, history, relevant),
      });

      const answer =
        typeof result.answer === 'string' ? result.answer.trim() : '';
      if (!answer || result.confident === false) {
        return this.fallback(history, message, relevant);
      }

      return {
        answer,
        sources: relevant,
        suggestTicket: false,
        prefill: null,
        provider: this.ai.providerName,
      };
    } catch (err) {
      // Chatbot tidak boleh 500 — fallback ke penawaran tiket
      this.logger.warn(
        `LLM chat gagal: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.fallback(history, message, relevant);
    }
  }

  /** Semantic search + filter ambang similarity */
  private async findRelevant(message: string): Promise<ChatSource[]> {
    let results: {
      id: string;
      title: string;
      slug: string;
      similarity: number;
      content: string;
    }[];
    try {
      results = await this.knowledge.search(message, 5);
    } catch (err) {
      this.logger.warn(
        `RAG search gagal: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
    return results
      .filter((r) => r.similarity >= this.minSimilarity)
      .map(({ id, title, slug, similarity, content }) => ({
        id,
        title,
        slug,
        similarity,
        content: content.slice(0, CONTEXT_SNIPPET_LENGTH),
      }));
  }

  private buildPrompt(
    message: string,
    history: ChatHistoryItemDto[],
    sources: ChatSource[],
  ): string {
    const context = sources
      .map(
        (s) =>
          `- ${s.title} (${s.slug}, similarity ${s.similarity.toFixed(2)}): ${s.content}`,
      )
      .join('\n');
    const transcript = history
      .map((h) => `${h.role === 'user' ? 'User' : 'Asisten'}: ${h.content}`)
      .join('\n');

    return [
      `Konteks artikel:\n${context}`,
      transcript ? `\nRiwayat percakapan:\n${transcript}` : '',
      `\nPertanyaan user: ${message}`,
      '',
      'Balas JSON dengan skema: {"answer":"...","confident":true|false}',
      'Aturan: confident=false jika konteks di atas tidak cukup untuk menjawab.',
    ]
      .filter((part) => part !== '')
      .join('\n');
  }

  private fallback(
    history: ChatHistoryItemDto[],
    message: string,
    sources: ChatSource[],
  ): ChatResult {
    return {
      answer: FALLBACK_ANSWER,
      sources,
      suggestTicket: true,
      prefill: this.buildPrefill(history, message),
      provider: this.ai.providerName,
    };
  }

  /**
   * Data chat → prefill form tiket:
   * - title: pesan user pertama (min 3 karakter, max 80)
   * - description: transcript percakapan lengkap
   */
  private buildPrefill(
    history: ChatHistoryItemDto[],
    message: string,
  ): ChatPrefill {
    const firstUserMsg =
      history.find((h) => h.role === 'user')?.content ?? message;
    const cleaned = firstUserMsg.replace(/\s+/g, ' ').trim();
    const title =
      cleaned.length >= 3
        ? cleaned.slice(0, 80)
        : `Chat: ${cleaned}`.slice(0, 80);

    const lines = [
      '[Percakapan dengan AI Help Desk]',
      ...history.map(
        (h) => `${h.role === 'user' ? 'User' : 'Asisten'}: ${h.content}`,
      ),
      `User: ${message}`,
    ];
    return { title, description: lines.join('\n') };
  }
}
