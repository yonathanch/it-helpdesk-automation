import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  const prisma = {
    category: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CategoriesService(prisma as never);
  });

  it('create: slug dibuat otomatis dari nama', async () => {
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.category.create.mockResolvedValue({ id: 'c1', slug: 'akun-akses' });

    await service.create({ name: 'Akun & Akses' });

    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'akun-akses' }),
      }),
    );
  });

  it('create: menolak nama duplikat', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'c-existing' });

    await expect(service.create({ name: 'Hardware' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('delete: menolak kategori yang masih dipakai tiket', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      _count: { tickets: 3 },
    });

    await expect(service.remove('c1')).rejects.toThrow(BadRequestException);
    expect(prisma.category.delete).not.toHaveBeenCalled();
  });

  it('delete: kategori kosong berhasil dihapus', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      _count: { tickets: 0 },
    });
    prisma.category.delete.mockResolvedValue({});

    const result = await service.remove('c1');

    expect(result).toEqual({ deleted: true });
  });

  it('update: kategori tidak ada → NotFound', async () => {
    prisma.category.findUnique.mockResolvedValue(null);

    await expect(service.update('c-404', {})).rejects.toThrow(
      NotFoundException,
    );
  });
});
