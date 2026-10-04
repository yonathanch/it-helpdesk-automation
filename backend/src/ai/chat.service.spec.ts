import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';

describe('A-4: ChatService', () => {
  let service: ChatService;

  const knowledge = { search: jest.fn() };
  const ai = {
    completeJson: jest.fn(),
    providerName: 'mock',
  };

  const makeConfig = (overrides: Record<string, string> = {}) =>
    ({
      get: jest.fn((key: string) => overrides[key]),
    }) as unknown as ConfigService;

  const article = {
    id: 'a1',
    title: 'Cara Reset Password',
    slug: 'reset-password',
    content: 'Buka halaman reset, masukkan email, ikuti tautan di email.',
    similarity: 0.85,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatService(makeConfig(), ai as never, knowledge as never);
  });

  describe('jalur RAG (jawaban ditemukan)', () => {
    it('menjawab dari konteks artikel + mengembalikan sumber', async () => {
      knowledge.search.mockResolvedValue([article]);
      ai.completeJson.mockResolvedValue({
        answer: 'Buka halaman reset password.',
        confident: true,
      });

      const result = await service.chat(
        { message: 'lupa sandi gimana?' },
        'u1',
      );

      expect(result.answer).toBe('Buka halaman reset password.');
      expect(result.suggestTicket).toBe(false);
      expect(result.prefill).toBeNull();
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].slug).toBe('reset-password');
      expect(knowledge.search).toHaveBeenCalledWith('lupa sandi gimana?', 5);
    });

    it('LLM confident=false → fallback tawarkan tiket', async () => {
      knowledge.search.mockResolvedValue([article]);
      ai.completeJson.mockResolvedValue({ answer: 'entah', confident: false });

      const result = await service.chat({ message: 'entahlah' }, 'u1');

      expect(result.suggestTicket).toBe(true);
      expect(result.prefill).not.toBeNull();
    });

    it('LLM error → fallback (chatbot tidak 500)', async () => {
      knowledge.search.mockResolvedValue([article]);
      ai.completeJson.mockRejectedValue(new Error('API down'));

      const result = await service.chat({ message: 'halo' }, 'u1');

      expect(result.suggestTicket).toBe(true);
      expect(result.prefill?.title).toContain('halo');
    });
  });

  describe('fallback (tidak ada konteks)', () => {
    it('search kosong → langsung fallback tanpa panggil LLM', async () => {
      knowledge.search.mockResolvedValue([]);

      const result = await service.chat({ message: 'printer rusak' }, 'u1');

      expect(result.suggestTicket).toBe(true);
      expect(ai.completeJson).not.toHaveBeenCalled();
      expect(result.prefill).toEqual({
        title: 'printer rusak',
        description: expect.stringContaining('User: printer rusak'),
      });
    });

    it('similarity di bawah ambang → dianggap tidak relevan', async () => {
      service = new ChatService(
        makeConfig({ CHAT_MIN_SIMILARITY: '0.5' }),
        ai as never,
        knowledge as never,
      );
      knowledge.search.mockResolvedValue([{ ...article, similarity: 0.2 }]);

      const result = await service.chat({ message: 'x' }, 'u1');

      expect(result.suggestTicket).toBe(true);
      expect(ai.completeJson).not.toHaveBeenCalled();
    });

    it('search error (pgvector down) → fallback, bukan throw', async () => {
      knowledge.search.mockRejectedValue(new Error('db down'));

      const result = await service.chat({ message: 'tes' }, 'u1');

      expect(result.suggestTicket).toBe(true);
      expect(result.prefill).not.toBeNull();
    });
  });

  describe('prefill dari data chat', () => {
    it('title = pesan user pertama, description = transcript', async () => {
      knowledge.search.mockResolvedValue([]);

      const result = await service.chat(
        {
          message: 'udah dicoba restart',
          history: [
            { role: 'user', content: 'laptop saya mati total' },
            { role: 'assistant', content: 'coba charger dulu' },
          ],
        },
        'u1',
      );

      expect(result.prefill?.title).toBe('laptop saya mati total');
      expect(result.prefill?.description).toContain(
        'User: laptop saya mati total',
      );
      expect(result.prefill?.description).toContain(
        'Asisten: coba charger dulu',
      );
      expect(result.prefill?.description).toContain(
        'User: udah dicoba restart',
      );
    });

    it('pesan sangat pendek → title tetap min 3 karakter', async () => {
      knowledge.search.mockResolvedValue([]);

      const result = await service.chat({ message: 'hi' }, 'u1');

      expect(result.prefill!.title.length).toBeGreaterThanOrEqual(3);
    });
  });
});
