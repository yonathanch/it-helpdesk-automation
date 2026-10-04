import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { tickets: true } } },
    });
  }

  async create(dto: CreateCategoryDto) {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    const existing = await this.prisma.category.findFirst({
      where: { OR: [{ name: dto.name }, { slug }] },
    });
    if (existing) {
      throw new ConflictException(
        existing.name === dto.name
          ? 'Nama kategori sudah dipakai'
          : 'Slug kategori sudah dipakai',
      );
    }
    return this.prisma.category.create({
      data: { name: dto.name, slug, description: dto.description },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan');
    }

    const slug = dto.slug ? slugify(dto.slug) : undefined;
    if (slug || dto.name) {
      const clash = await this.prisma.category.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(dto.name ? [{ name: dto.name }] : []),
            ...(slug ? [{ slug }] : []),
          ],
        },
      });
      if (clash) {
        throw new ConflictException(
          'Nama atau slug sudah dipakai kategori lain',
        );
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(slug ? { slug } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      },
    });
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { tickets: true } } },
    });
    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan');
    }
    if (category._count.tickets > 0) {
      throw new BadRequestException(
        `Kategori masih dipakai oleh ${category._count.tickets} tiket — tidak bisa dihapus`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
    return { deleted: true };
  }
}
