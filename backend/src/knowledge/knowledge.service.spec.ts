import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { CreateArticleDto } from './dto/create-article.dto';

describe('A-3: KnowledgeService', () => {
  let service: KnowledgeService;

  const prisma = {
    knowledgeArticle: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
  const ai = {
    embed: jest.fn().mockResolvedValue(new Array(1536).fill(0.001)),
    embeddingProviderName: 'mock',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KnowledgeService(prisma as never, ai as never);
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.$queryRaw.mockResolvedValue([]);
  });

  describe('create', () => {
    const dto: CreateArticleDto = {
      title: 'Cara Install VPN',
      content: '# Install VPN\nDownload klien VPN lalu login.',
      published: true,
    };

    it('artikel published langsung di-embed ke pgvector', async () => {
      prisma.knowledgeArticle.findUnique
        .mockResolvedValueOnce(null) // cek slug
        .mockResolvedValueOnce({
          // embedArticle: butuh title+content
          id: 'a1',
          title: 'Cara Install VPN',
          content: '# Install VPN',
        })
        .mockResolvedValueOnce({
          // findOne (return akhir)
          id: 'a1',
          slug: 'cara-install-vpn',
          published: true,
        });
      prisma.knowledgeArticle.create.mockResolvedValue({
        id: 'a1',
        slug: 'cara-install-vpn',
        published: true,
      });
      prisma.knowledgeArticle.findMany.mockResolvedValue([]);

      await service.create(dto, 'admin-1');

      expect(ai.embed).toHaveBeenCalledWith(
        expect.stringContaining('Cara Install VPN'),
      );
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('artikel draft TIDAK di-embed', async () => {
      prisma.knowledgeArticle.findUnique
        .mockResolvedValueOnce(null) // cek slug
        .mockResolvedValueOnce({ id: 'a2', slug: 'draft-x', published: false }); // findOne
      prisma.knowledgeArticle.create.mockResolvedValue({
        id: 'a2',
        slug: 'draft-x',
        published: false,
      });
      prisma.knowledgeArticle.findMany.mockResolvedValue([]);

      await service.create({ ...dto, published: false }, 'admin-1');

      expect(ai.embed).not.toHaveBeenCalled();
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('query kosong → BadRequestException', async () => {
      await expect(service.search('   ')).rejects.toThrow(BadRequestException);
      expect(ai.embed).not.toHaveBeenCalled();
    });

    it('mengembalikan hasil dengan skor similarity', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'a1',
          title: 'Cara Reset Password',
          slug: 'reset-password',
          content: '...',
          similarity: 0.91,
        },
      ]);

      const results = await service.search('lupa sandi');

      expect(ai.embed).toHaveBeenCalledWith('lupa sandi');
      expect(results).toEqual([
        expect.objectContaining({
          slug: 'reset-password',
          similarity: 0.91,
        }),
      ]);
    });
  });

  describe('embedAll', () => {
    it('re-embed semua artikel published', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
      prisma.knowledgeArticle.findUnique.mockResolvedValue({
        id: 'a1',
        title: 'T',
        content: 'C',
      });

      const result = await service.embedAll();

      expect(result).toEqual({ embedded: 2 });
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe('findOne', () => {
    it('draft tidak terlihat oleh non-admin', async () => {
      prisma.knowledgeArticle.findUnique.mockResolvedValue({
        slug: 'x',
        published: false,
      });

      await expect(service.findOne('x', false)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
