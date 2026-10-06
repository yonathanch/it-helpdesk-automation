import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';

jest.mock('bcrypt');

describe('UsersService', () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash-rahasia');
    service = new UsersService(prisma as never);
  });

  describe('findAll', () => {
    it('mengembalikan data dengan metadata paginasi', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Ani' }]);
      prisma.user.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('tidak pernah menyertakan passwordHash di select', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({});

      const call = prisma.user.findMany.mock.calls[0][0];
      expect(call.select).toHaveProperty('email');
      expect(call.select).not.toHaveProperty('passwordHash');
    });

    it('memfilter role dan status aktif', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ role: Role.AGENT, isActive: 'false' });

      const where = prisma.user.findMany.mock.calls[0][0].where;
      expect(where.role).toBe(Role.AGENT);
      expect(where.isActive).toBe(false);
    });

    it('menerjemahkan isActive="true" menjadi boolean true', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ isActive: 'true' });

      expect(prisma.user.findMany.mock.calls[0][0].where.isActive).toBe(true);
    });

    it('mencari pada nama, email, dan departemen', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ search: 'budi' });

      const where = prisma.user.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(3);
    });
  });

  describe('create', () => {
    it('menyimpan password sebagai hash, bukan teks asli', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u9' });

      await service.create({
        name: 'Agen Baru',
        email: 'agen.baru@helpdesk.local',
        password: 'Rahasia123',
        role: Role.AGENT,
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('Rahasia123', 10);
      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.passwordHash).toBe('hash-rahasia');
      expect(data.password).toBeUndefined();
    });

    it('mengizinkan pembuatan akun AGENT dan ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u9' });

      await service.create({
        name: 'Admin Kedua',
        email: 'admin2@helpdesk.local',
        password: 'Rahasia123',
        role: Role.ADMIN,
      });

      expect(prisma.user.create.mock.calls[0][0].data.role).toBe(Role.ADMIN);
    });

    it('menolak email yang sudah terdaftar', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });

      await expect(
        service.create({
          name: 'Ganda',
          email: 'ada@helpdesk.local',
          password: 'Rahasia123',
          role: Role.END_USER,
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('menyimpan departemen kosong sebagai null, bukan string kosong', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u9' });

      await service.create({
        name: 'Tanpa Dept',
        email: 'nodept@helpdesk.local',
        password: 'Rahasia123',
        role: Role.END_USER,
        department: '   ',
      });

      expect(prisma.user.create.mock.calls[0][0].data.department).toBeNull();
    });
  });

  describe('update', () => {
    const admin = {
      id: 'admin-1',
      role: Role.ADMIN,
      isActive: true,
      name: 'Admin',
    };

    it('menolak bila pengguna tidak ada', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('tidak-ada', { name: 'X' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('menolak admin aktif terakhir diturunkan jadi AGENT', async () => {
      prisma.user.findUnique.mockResolvedValue(admin);
      prisma.user.count.mockResolvedValue(1); // hanya dia satu-satunya admin

      await expect(
        service.update('admin-1', { role: Role.AGENT }, 'admin-lain'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('menolak admin aktif terakhir dinonaktifkan', async () => {
      prisma.user.findUnique.mockResolvedValue(admin);
      prisma.user.count.mockResolvedValue(1);

      await expect(
        service.update('admin-1', { isActive: false }, 'admin-lain'),
      ).rejects.toThrow(BadRequestException);
    });

    it('mengizinkan penurunan bila masih ada admin aktif lain', async () => {
      prisma.user.findUnique.mockResolvedValue(admin);
      prisma.user.count.mockResolvedValue(2);
      prisma.user.update.mockResolvedValue({ id: 'admin-1', role: Role.AGENT });

      await service.update('admin-1', { role: Role.AGENT }, 'admin-lain');

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('menolak admin mengubah role akunnya sendiri', async () => {
      prisma.user.findUnique.mockResolvedValue(admin);
      prisma.user.count.mockResolvedValue(5);

      await expect(
        service.update('admin-1', { role: Role.END_USER }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('menolak menonaktifkan akun sendiri', async () => {
      prisma.user.findUnique.mockResolvedValue(admin);
      prisma.user.count.mockResolvedValue(5);

      await expect(
        service.update('admin-1', { isActive: false }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('mengizinkan mengubah nama akun sendiri', async () => {
      prisma.user.findUnique.mockResolvedValue(admin);
      prisma.user.update.mockResolvedValue({
        id: 'admin-1',
        name: 'Nama Baru',
      });

      await service.update('admin-1', { name: 'Nama Baru' }, 'admin-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'Nama Baru' } }),
      );
    });

    it('menolak permintaan tanpa perubahan sama sekali', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        role: Role.END_USER,
        isActive: true,
      });

      await expect(service.update('u2', {}, 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('menyertakan hanya field yang dikirim (partial update)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        role: Role.END_USER,
        isActive: true,
      });
      prisma.user.update.mockResolvedValue({ id: 'u2' });

      await service.update('u2', { isActive: false }, 'admin-1');

      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data).toEqual({ isActive: false });
      expect(data).not.toHaveProperty('name');
    });
  });

  describe('listAgents', () => {
    it('hanya mengembalikan AGENT/ADMIN aktif beserta beban kerjanya', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'a1',
          name: 'Agen A',
          email: 'a@x.com',
          role: Role.AGENT,
          _count: { assignedTickets: 4 },
        },
      ]);

      const result = await service.listAgents();

      const args = prisma.user.findMany.mock.calls[0][0];
      expect(args.where.isActive).toBe(true);
      expect(args.where.role.in).toEqual([Role.AGENT, Role.ADMIN]);
      expect(result[0].activeTickets).toBe(4);
      // hanya menghitung tiket yang belum selesai
      const statusFilter =
        args.select._count.select.assignedTickets.where.status.in;
      expect(statusFilter).toEqual(['OPEN', 'IN_PROGRESS', 'WAITING_USER']);
      expect(statusFilter).not.toContain('CLOSED');
    });
  });
});
