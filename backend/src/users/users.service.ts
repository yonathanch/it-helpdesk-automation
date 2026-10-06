import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto, parseIsActive } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * Kolom user yang boleh keluar dari API.
 *
 * `passwordHash` TIDAK PERNAH disertakan. Semua query di service ini memakai
 * konstanta ini, jadi tidak ada jalur yang bisa membocorkan hash.
 */
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

/** Ringkasan agen untuk dropdown penugasan tiket. */
export interface AgentOption {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Jumlah tiket aktif yang sedang ditangani — dipakai menampilkan beban. */
  activeTickets: number;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Daftar pengguna dengan filter & paginasi (ADMIN). */
  async findAll(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const isActive = parseIsActive(query.isActive);

    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (isActive !== undefined) where.isActive = isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { department: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { [query.sortBy ?? 'name']: query.sortOrder ?? 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Buat akun baru dengan role apa pun (ADMIN). */
  async create(dto: CreateUserDto): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
        department: dto.department?.trim() || null,
      },
      select: USER_SELECT,
    });
  }

  /** Ubah data pengguna (ADMIN). */
  async update(
    id: string,
    dto: UpdateUserDto,
    currentUserId: string,
  ): Promise<SafeUser> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }

    const demoting = dto.role !== undefined && dto.role !== Role.ADMIN;
    const deactivating = dto.isActive === false;

    // --- Anti lock-out: jangan sampai sistem kehilangan admin terakhir ---
    if (
      target.role === Role.ADMIN &&
      target.isActive &&
      (demoting || deactivating)
    ) {
      const activeAdmins = await this.prisma.user.count({
        where: { role: Role.ADMIN, isActive: true },
      });
      if (activeAdmins <= 1) {
        throw new BadRequestException(
          'Tidak bisa menurunkan atau menonaktifkan admin aktif terakhir — sistem akan terkunci',
        );
      }
    }

    // --- Anti bunuh diri akun sendiri ---
    if (id === currentUserId) {
      if (dto.role !== undefined && dto.role !== target.role) {
        throw new BadRequestException(
          'Tidak bisa mengubah role akun sendiri — minta admin lain melakukannya',
        );
      }
      if (deactivating) {
        throw new BadRequestException('Tidak bisa menonaktifkan akun sendiri');
      }
    }

    if (
      dto.name === undefined &&
      dto.department === undefined &&
      dto.role === undefined &&
      dto.isActive === undefined
    ) {
      throw new BadRequestException('Tidak ada perubahan yang dikirim');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.department !== undefined
          ? { department: dto.department.trim() || null }
          : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: USER_SELECT,
    });
  }

  /**
   * Agen & admin aktif untuk dropdown penugasan tiket.
   *
   * Tersedia untuk AGENT dan ADMIN — bukan hanya ADMIN — karena agen yang
   * menangani tiket perlu bisa memilih rekan penanggung jawab.
   */
  async listAgents(): Promise<AgentOption[]> {
    const agents = await this.prisma.user.findMany({
      where: { isActive: true, role: { in: [Role.AGENT, Role.ADMIN] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        _count: {
          select: {
            assignedTickets: {
              // Tiket yang belum selesai = beban kerja berjalan.
              where: {
                status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER'] },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      activeTickets: agent._count.assignedTickets,
    }));
  }
}
