import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Teks yang di-embed: judul + isi (judul bobotnya lebih tinggi) */
const embeddingText = (title: string, content: string): string =>
  `${title}\n${title}\n${content}`;

@Injectable()
export class KnowledgeService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /** Backfill: embed artikel published yang belum punya embedding */
  async onModuleInit() {
    const missing = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM knowledge_articles
      WHERE embedding IS NULL AND published = true
    `;
    if (missing.length === 0) return;

    this.logger.log(`Backfill embedding untuk ${missing.length} artikel...`);
    for (const row of missing) {
      try {
        await this.embedArticle(row.id);
      } catch (err) {
        this.logger.warn(
          `Backfill gagal untuk ${row.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    this.logger.log('Backfill embedding selesai');
  }

  async findAll(includeDraft = false) {
    return this.prisma.knowledgeArticle.findMany({
      where: includeDraft ? {} : { published: true },
      select: {
        id: true,
        title: true,
        slug: true,
        published: true,
        embeddedAt: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, name: true } },
        category: { select: { name: true, slug: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(slug: string, includeDraft = false) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, name: true } },
        category: { select: { name: true, slug: true } },
      },
    });
    if (!article || (!includeDraft && !article.published)) {
      throw new NotFoundException('Artikel tidak ditemukan');
    }
    return article;
  }

  async create(dto: CreateArticleDto, authorId: string) {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.title);
    const existing = await this.prisma.knowledgeArticle.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Slug artikel sudah dipakai');
    }

    const article = await this.prisma.knowledgeArticle.create({
      data: {
        title: dto.title,
        content: dto.content,
        slug,
        categoryId: dto.categoryId,
        published: dto.published ?? false,
        authorId,
      },
    });

    if (article.published) {
      await this.embedArticle(article.id);
    }
    return this.findOne(article.slug, true);
  }

  async update(id: string, dto: UpdateArticleDto) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
    });
    if (!article) {
      throw new NotFoundException('Artikel tidak ditemukan');
    }

    const updated = await this.prisma.knowledgeArticle.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.slug !== undefined ? { slug: slugify(dto.slug) } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.published !== undefined ? { published: dto.published } : {}),
      },
    });

    // konten berubah / terbit → embed ulang
    if (
      updated.published &&
      (dto.content !== undefined ||
        dto.title !== undefined ||
        dto.slug !== undefined ||
        article.published !== updated.published)
    ) {
      await this.embedArticle(updated.id);
    }
    return this.findOne(updated.slug, true);
  }

  async remove(id: string) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
    });
    if (!article) {
      throw new NotFoundException('Artikel tidak ditemukan');
    }
    await this.prisma.knowledgeArticle.delete({ where: { id } });
    return { deleted: true };
  }

  /** A-3: semantic search via cosine similarity pgvector */
  async search(query: string, limit = 5) {
    const q = query.trim();
    if (!q) {
      throw new BadRequestException('Query pencarian kosong');
    }

    const vector = await this.ai.embed(q);
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        title: string;
        slug: string;
        content: string;
        similarity: number;
      }[]
    >`
      SELECT id, title, slug, content,
             1 - (embedding <=> ${JSON.stringify(vector)}::vector) AS similarity
      FROM knowledge_articles
      WHERE published = true AND embedding IS NOT NULL
      ORDER BY embedding <=> ${JSON.stringify(vector)}::vector
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      content: r.content,
      similarity: Number(r.similarity),
    }));
  }

  /** Embed 1 artikel → simpan ke pgvector + tandai embeddedAt */
  async embedArticle(id: string): Promise<void> {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
    });
    if (!article) {
      throw new NotFoundException('Artikel tidak ditemukan');
    }

    const vector = await this.ai.embed(
      embeddingText(article.title, article.content),
    );
    await this.prisma.$executeRaw`
      UPDATE knowledge_articles
      SET embedding = ${JSON.stringify(vector)}::vector,
          "embeddedAt" = now()
      WHERE id = ${id}
    `;
    this.logger.log(
      `Embed "${article.title}" (${vector.length} dim) via ${this.ai.embeddingProviderName}`,
    );
  }

  /** Re-embed semua artikel published (endpoint admin) */
  async embedAll() {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM knowledge_articles WHERE published = true
    `;
    for (const row of rows) {
      await this.embedArticle(row.id);
    }
    return { embedded: rows.length };
  }
}
