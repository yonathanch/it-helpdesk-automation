import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Role } from '@prisma/client';

/**
 * Survei kepuasan (CSAT).
 *
 * Aturan:
 * - Hanya pelapor tiket yang boleh menilai (pemilik tiket, bukan agen/admin).
 * - Satu tiket hanya boleh dinilai satu kali (dijamin unique constraint
 *   `ticketId` pada tabel csat_surveys).
 * - Tiket harus sudah selesai, karena penilaian sebelumResolution tidak
 *   merepresentasikan kepuasan.
 */
@Injectable()
export class SurveyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Buat atau baca penilaian untuk satu tiket (dari sisi pengguna). */
  async submit(input: {
    ticketId: string;
    userId: string;
    role: Role;
    rating: number;
    comment?: string;
  }) {
    if (
      !Number.isInteger(input.rating) ||
      input.rating < 1 ||
      input.rating > 5
    ) {
      throw new BadRequestException('Rating harus berupa angka 1 sampai 5');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: input.ticketId },
      select: { id: true, code: true, requesterId: true, status: true },
    });
    if (!ticket) throw new NotFoundException('Tiket tidak ditemukan');

    if (ticket.requesterId !== input.userId) {
      throw new ForbiddenException(
        'Hanya pelapor tiket yang dapat memberikan penilaian',
      );
    }

    const finished = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
    if (!finished) {
      throw new BadRequestException(
        'Penilaian hanya bisa diberikan setelah tiket selesai',
      );
    }

    const existing = await this.prisma.cSATSurvey.findUnique({
      where: { ticketId: input.ticketId },
    });
    if (existing) {
      throw new ConflictException('Tiket ini sudah pernah dinilai');
    }

    return this.prisma.cSATSurvey.create({
      data: {
        ticketId: input.ticketId,
        userId: input.userId,
        rating: input.rating,
        comment: input.comment?.trim() || null,
      },
    });
  }

  /** Daftar penilaian terbaru (untuk admin). */
  async list(limit = 50) {
    return this.prisma.cSATSurvey.findMany({
      take: Math.min(Math.max(limit, 1), 100),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        ticket: { select: { id: true, code: true, title: true } },
        user: { select: { id: true, name: true } },
      },
    });
  }
}
