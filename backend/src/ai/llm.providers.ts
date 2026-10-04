/**
 * A-1: AI service layer — abstraction agar mudah ganti provider LLM.
 * Semua provider hanya butuh satu metode: complete().
 */

export interface LlmCompleteInput {
  prompt: string;
  system?: string;
  /** minta model mengembalikan JSON murni */
  json?: boolean;
}

export interface LlmProvider {
  readonly name: string;
  complete(input: LlmCompleteInput): Promise<string>;
}

const stripCodeFence = (text: string): string => {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : trimmed;
};

// ============ OpenAI (juga kompatibel dengan proxy/gateway OpenAI-style) ============

export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly model = 'gpt-4o-mini',
    private readonly baseUrl = 'https://api.openai.com/v1',
  ) {}

  async complete(input: LlmCompleteInput): Promise<string> {
    const messages: { role: string; content: string }[] = [];
    if (input.system) messages.push({ role: 'system', content: input.system });
    messages.push({ role: 'user', content: input.prompt });

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0,
        ...(input.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return stripCodeFence(data.choices[0].message.content);
  }
}

// ============ Anthropic Claude ============

export class ClaudeProvider implements LlmProvider {
  readonly name = 'claude';

  constructor(
    private readonly apiKey: string,
    private readonly model = 'claude-sonnet-4-5',
    private readonly baseUrl = 'https://api.anthropic.com',
  ) {}

  async complete(input: LlmCompleteInput): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        ...(input.system ? { system: input.system } : {}),
        messages: [{ role: 'user', content: input.prompt }],
        ...(input.json
          ? {
              output_config: {
                format: { type: 'json_schema' },
              },
            }
          : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`Claude API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { content: { text: string }[] };
    return stripCodeFence(data.content[0].text);
  }
}

// ============ Google Gemini ============

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    private readonly model = 'gemini-2.0-flash',
    private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta',
  ) {}

  async complete(input: LlmCompleteInput): Promise<string> {
    const res = await fetch(
      `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(input.system
            ? { system_instruction: { parts: [{ text: input.system }] } }
            : {}),
          contents: [{ parts: [{ text: input.prompt }] }],
          ...(input.json
            ? { generationConfig: { responseMimeType: 'application/json' } }
            : {}),
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
    };
    return stripCodeFence(data.candidates[0].content.parts[0].text);
  }
}

// ============ Ollama (lokal, tanpa API key) ============

export class OllamaProvider implements LlmProvider {
  readonly name = 'ollama';

  constructor(
    private readonly model = 'llama3.2',
    private readonly baseUrl = 'http://localhost:11434',
  ) {}

  async complete(input: LlmCompleteInput): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: input.prompt,
        system: input.system,
        format: input.json ? 'json' : undefined,
        stream: false,
        temperature: 0,
      }),
    });
    if (!res.ok) {
      throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { response: string };
    return stripCodeFence(data.response);
  }
}

// ============ Mock (dev tanpa API key — deterministik untuk testing) ============

export class MockProvider implements LlmProvider {
  readonly name = 'mock';

  complete(input: LlmCompleteInput): Promise<string> {
    // Hanya analisis isi tiket (judul+deskripsi), BUKAN instruksi skema —
    // teks skema mengandung kata seperti "URGENT" yang akan mengotori klasifikasi
    const contentMatch = input.prompt.match(
      /Judul:\s*([\s\S]*?)(?:\n\nKategori yang tersedia:|$)/,
    );
    const text = (contentMatch ? contentMatch[1] : input.prompt).toLowerCase();

    if (!input.json) {
      return Promise.resolve('[mock] Jawaban generik dari MockProvider.');
    }

    // ---- A-4: chatbot (prompt punya "Pertanyaan user:") ----
    if (input.prompt.includes('Pertanyaan user:')) {
      // hanya baris pertama setelah penanda (jangan ikut instruksi skema JSON)
      const question =
        input.prompt.match(/Pertanyaan user:\s*([^\n]*)/)?.[1]?.trim() ?? '';
      const articleLine = input.prompt.match(/Konteks artikel:\n- ([^\n(]+)/);
      const articleTitle = articleLine?.[1]?.trim();
      return Promise.resolve(
        JSON.stringify({
          answer: articleTitle
            ? `Berdasarkan artikel "${articleTitle}": ${question.slice(0, 120)} — ikuti panduan pada artikel tersebut. (jawaban MockProvider)`
            : 'Maaf, saya belum menemukan jawaban yang cocok.',
          confident: Boolean(articleTitle),
        }),
      );
    }

    // ---- A-5: draft reply (prompt punya "Tulis draft balasan") ----
    if (input.prompt.includes('Tulis draft balasan')) {
      const title =
        input.prompt.match(/Judul:\s*([^\n]+)/)?.[1]?.trim() ?? 'masalah Anda';
      return Promise.resolve(
        JSON.stringify({
          draft:
            `Halo, terima kasih sudah menghubungi IT Help Desk terkait "${title}". ` +
            'Kami sudah menerima laporan Anda dan sedang menindaklanjuti. ' +
            'Mohon kabari jika ada perkembangan tambahan. (draft MockProvider)',
        }),
      );
    }

    // Sinyal sentimen (kata frustasi/marah)
    const negativeSignals = [
      'frustasi',
      'frustrasi',
      'marah',
      'kecewa',
      'kesal',
      'sudah berkali',
      'tidak profesional',
      'lambat sekali',
      'sejak kemarin',
      'mendesak sekali',
    ];
    const sentiment = negativeSignals.some((s) => text.includes(s))
      ? 'negative'
      : 'neutral';

    // Deteksi kategori dari keyword
    let categorySlug = 'lainnya';
    if (/printer|cetak|scan|scanner/.test(text)) categorySlug = 'hardware';
    else if (/laptop|monitor|keyboard|mouse|baterai|rusak fisik/.test(text))
      categorySlug = 'hardware';
    else if (
      /vpn|jaringan|internet|wifi|switch|kabel|network|mati total jaringan/.test(
        text,
      )
    )
      categorySlug = 'network';
    else if (/password|akun|login|akses|reset|lupa/.test(text))
      categorySlug = 'akun-akses';
    else if (/aplikasi|software|error|crash|install|office|program/.test(text))
      categorySlug = 'software';

    // Deteksi prioritas (TANPA mempertimbangkan sentimen —
    // eskalasi karena sentimen adalah tugas TriageService)
    let priority = 'MEDIUM';
    if (
      /mati total|urgent|darurat|down|tidak bisa sama sekali|tertahan/.test(
        text,
      )
    )
      priority = 'HIGH';
    return Promise.resolve(
      JSON.stringify({
        categorySlug,
        priority,
        sentiment,
        confidence: 0.85,
        reason:
          'Hasil klasifikasi MockProvider (rule-based keyword) — bukan LLM sungguhan.',
      }),
    );
  }
}

// ============ Factory ============

export function createLlmProvider(env: {
  LLM_PROVIDER?: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
  LLM_BASE_URL?: string;
}): LlmProvider {
  const provider = (env.LLM_PROVIDER ?? 'mock').toLowerCase();
  const apiKey = env.LLM_API_KEY ?? '';
  const model = env.LLM_MODEL || undefined;
  const baseUrl = env.LLM_BASE_URL || undefined;

  switch (provider) {
    case 'openai':
      if (!apiKey)
        throw new Error('LLM_API_KEY belum diisi untuk provider openai');
      return new OpenAiProvider(apiKey, model, baseUrl);
    case 'claude':
      if (!apiKey)
        throw new Error('LLM_API_KEY belum diisi untuk provider claude');
      return new ClaudeProvider(apiKey, model, baseUrl);
    case 'gemini':
      if (!apiKey)
        throw new Error('LLM_API_KEY belum diisi untuk provider gemini');
      return new GeminiProvider(apiKey, model, baseUrl);
    case 'ollama':
      return new OllamaProvider(model, baseUrl);
    case 'mock':
      return new MockProvider();
    default:
      throw new Error(
        `LLM_PROVIDER tidak dikenal: "${provider}" (pilihan: openai|claude|gemini|ollama|mock)`,
      );
  }
}
