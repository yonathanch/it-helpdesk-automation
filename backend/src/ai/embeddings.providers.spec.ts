import {
  createEmbeddingProvider,
  MockEmbeddingProvider,
} from './embeddings.providers';

const cosine = (a: number[], b: number[]): number => {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
};

describe('A-3: Embedding providers', () => {
  it('factory membuat MockProvider untuk provider=mock', () => {
    const p = createEmbeddingProvider({ EMBEDDING_PROVIDER: 'mock' });
    expect(p).toBeInstanceOf(MockEmbeddingProvider);
    expect(p.dimensions).toBe(1536);
  });

  it('factory menolak provider tak dikenal', () => {
    expect(() =>
      createEmbeddingProvider({ EMBEDDING_PROVIDER: 'surga' }),
    ).toThrow('tidak dikenal');
  });

  it('factory openai tanpa key → error jelas', () => {
    expect(() =>
      createEmbeddingProvider({ EMBEDDING_PROVIDER: 'openai' }),
    ).toThrow('EMBEDDING_API_KEY');
  });

  it('mock: deterministik — teks sama → vektor sama', async () => {
    const p = new MockEmbeddingProvider();
    const a = await p.embed('cara reset password');
    const b = await p.embed('cara reset password');

    expect(a).toHaveLength(1536);
    expect(a).toEqual(b);
  });

  it('mock: vektor ternormalisasi (norm = 1)', async () => {
    const p = new MockEmbeddingProvider();
    const v = await p.embed('lupa password akun login');
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));

    expect(norm).toBeCloseTo(1, 5);
  });

  it('mock: teks mirip punya cosine similarity lebih tinggi', async () => {
    const p = new MockEmbeddingProvider();
    const query = await p.embed('lupa password akun');
    const mirip = await p.embed('cara mengatasi lupa password akun');
    const beda = await p.embed('printer macet tidak bisa cetak');

    expect(cosine(query, mirip)).toBeGreaterThan(cosine(query, beda));
  });

  it('mock: teks kosong tetap menghasilkan vektor valid', async () => {
    const p = new MockEmbeddingProvider();
    const v = await p.embed('');

    expect(v).toHaveLength(1536);
    expect(v.every((x) => Number.isFinite(x))).toBe(true);
  });
});
