import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  createLlmProvider,
  LlmCompleteInput,
  LlmProvider,
} from './llm.providers';
import {
  createEmbeddingProvider,
  EmbeddingProvider,
} from './embeddings.providers';

export interface TriageJob {
  ticketId: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly provider: LlmProvider;
  private readonly embedder: EmbeddingProvider;
  readonly triageQueue: Queue<TriageJob>;

  constructor(config: ConfigService) {
    this.provider = createLlmProvider({
      LLM_PROVIDER: config.get<string>('LLM_PROVIDER'),
      LLM_API_KEY: config.get<string>('LLM_API_KEY'),
      LLM_MODEL: config.get<string>('LLM_MODEL'),
      LLM_BASE_URL: config.get<string>('LLM_BASE_URL'),
    });
    this.logger.log(`LLM provider aktif: ${this.provider.name}`);

    this.embedder = createEmbeddingProvider({
      EMBEDDING_PROVIDER: config.get<string>('EMBEDDING_PROVIDER'),
      EMBEDDING_API_KEY: config.get<string>('EMBEDDING_API_KEY'),
      LLM_API_KEY: config.get<string>('LLM_API_KEY'),
      EMBEDDING_MODEL: config.get<string>('EMBEDDING_MODEL'),
      EMBEDDING_BASE_URL: config.get<string>('EMBEDDING_BASE_URL'),
    });
    this.logger.log(
      `Embedding provider aktif: ${this.embedder.name} (${this.embedder.dimensions} dim)`,
    );

    this.triageQueue = new Queue<TriageJob>('ai-triage', {
      connection: {
        host: config.get<string>('REDIS_HOST') ?? 'localhost',
        port: Number.parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10),
        maxRetriesPerRequest: null,
      },
    });
  }

  get providerName(): string {
    return this.provider.name;
  }

  get embeddingProviderName(): string {
    return this.embedder.name;
  }

  /** A-3: ubah teks menjadi vektor untuk pgvector */
  async embed(text: string): Promise<number[]> {
    return this.embedder.embed(text);
  }

  /** Panggil LLM, hasil mentah (string) */
  async complete(input: LlmCompleteInput): Promise<string> {
    return this.provider.complete(input);
  }

  /** Panggil LLM dengan ekspektasi JSON, parsing aman (toleran code fence) */
  async completeJson<T>(input: LlmCompleteInput): Promise<T> {
    const raw = await this.provider.complete({ ...input, json: true });
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/, '')
      .trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      throw new Error(`Respons LLM bukan JSON valid: ${raw.slice(0, 200)}`);
    }
  }

  /** Antrikan job triage tiket baru (diproses worker di background) */
  async enqueueTriage(ticketId: string): Promise<void> {
    await this.triageQueue.add(
      'triage',
      { ticketId },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
      },
    );
    this.logger.log(`Triage di-antrikan untuk tiket ${ticketId}`);
  }

  async onModuleDestroy() {
    await this.triageQueue.close();
  }
}
