/**
 * A-3: Embedding provider untuk RAG.
 * Sama seperti LLM — cukup ganti EMBEDDING_PROVIDER di .env.
 * Dimensi 1536 (compat pgvector column vector(1536)).
 */

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
}

// ============ OpenAI embeddings ============

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';
  readonly dimensions = 1536;

  constructor(
    private readonly apiKey: string,
    private readonly model = 'text-embedding-3-small',
    private readonly baseUrl = 'https://api.openai.com/v1',
  ) {}

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: text }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI Embeddings ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data[0].embedding;
  }
}

// ============ Mock (dev tanpa API key) ============

/**
 * Embedding deterministik berbasis hashing kata (bag-of-words ter-normalisasi).
 * Kualitas SEMANTIK palsu — tapi mekanisme (penyimpanan + cosine search) bisa
 * diuji: teks yang mirip punya cosine similarity lebih tinggi.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'mock';
  readonly dimensions = 1536;

  embed(text: string): Promise<number[]> {
    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1);

    for (const token of tokens) {
      // hash sederhana FNV-1a
      let hash = 2166136261;
      for (let i = 0; i < token.length; i++) {
        hash ^= token.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const idx = Math.abs(hash) % this.dimensions;
      vector[idx] += 1;
      // trigram/bigram chars untuk kedekatan ejaan
      if (token.length > 3) {
        const idx2 = Math.abs(hash >>> 8) % this.dimensions;
        vector[idx2] += 0.5;
      }
    }

    // normalisasi L2 agar cosine = dot product
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
    return Promise.resolve(vector.map((v) => v / norm));
  }
}

// ============ Factory ============

export function createEmbeddingProvider(env: {
  EMBEDDING_PROVIDER?: string;
  EMBEDDING_API_KEY?: string;
  LLM_API_KEY?: string;
  EMBEDDING_MODEL?: string;
  EMBEDDING_BASE_URL?: string;
}): EmbeddingProvider {
  const provider = (env.EMBEDDING_PROVIDER ?? 'mock').toLowerCase();
  const apiKey = env.EMBEDDING_API_KEY ?? env.LLM_API_KEY ?? '';

  switch (provider) {
    case 'openai':
      if (!apiKey) {
        throw new Error(
          'EMBEDDING_API_KEY (atau LLM_API_KEY) belum diisi untuk provider openai',
        );
      }
      return new OpenAiEmbeddingProvider(
        apiKey,
        env.EMBEDDING_MODEL || undefined,
        env.EMBEDDING_BASE_URL || undefined,
      );
    case 'mock':
      return new MockEmbeddingProvider();
    default:
      throw new Error(
        `EMBEDDING_PROVIDER tidak dikenal: "${provider}" (pilihan: openai|mock)`,
      );
  }
}
