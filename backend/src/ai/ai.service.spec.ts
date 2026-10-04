import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { createLlmProvider, MockProvider } from './llm.providers';

describe('A-1: AI service layer', () => {
  const makeConfig = (overrides: Record<string, string> = {}) =>
    ({
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          LLM_PROVIDER: 'mock',
          REDIS_PORT: '6379',
          ...overrides,
        };
        return map[key];
      }),
    }) as unknown as ConfigService;

  describe('createLlmProvider (factory)', () => {
    it('membuat MockProvider untuk LLM_PROVIDER=mock', () => {
      const provider = createLlmProvider({ LLM_PROVIDER: 'mock' });
      expect(provider).toBeInstanceOf(MockProvider);
      expect(provider.name).toBe('mock');
    });

    it('menolak provider tak dikenal', () => {
      expect(() => createLlmProvider({ LLM_PROVIDER: 'halu' })).toThrow(
        'tidak dikenal',
      );
    });

    it('menolak openai tanpa API key', () => {
      expect(() =>
        createLlmProvider({ LLM_PROVIDER: 'openai', LLM_API_KEY: '' }),
      ).toThrow('LLM_API_KEY belum diisi');
    });

    it('membuat provider claude ketika key tersedia', () => {
      const provider = createLlmProvider({
        LLM_PROVIDER: 'claude',
        LLM_API_KEY: 'sk-test',
      });
      expect(provider.name).toBe('claude');
    });
  });

  describe('AiService', () => {
    it('completeJson mengembalikan objek ter-parse dari MockProvider', async () => {
      const service = new AiService(makeConfig());

      const result = await service.completeJson<{ categorySlug: string }>({
        prompt: 'Tiket: VPN tidak bisa connect sejak kemarin, sangat frustasi',
      });

      expect(result).toHaveProperty('categorySlug');
      expect(typeof result.categorySlug).toBe('string');
    });

    it('providerName mencerminkan konfigurasi', () => {
      const service = new AiService(makeConfig());
      expect(service.providerName).toBe('mock');
    });

    it('MockProvider: keyword jaringan → slug network, sentimen negatif', async () => {
      const service = new AiService(makeConfig());
      const result = await service.completeJson<{
        categorySlug: string;
        sentiment: string;
      }>({
        prompt:
          'Judul: VPN error. Deskripsi: tidak bisa connect internet sejak kemarin, sangat frustasi!',
      });

      expect(result.categorySlug).toBe('network');
      expect(result.sentiment).toBe('negative');
    });
  });
});
