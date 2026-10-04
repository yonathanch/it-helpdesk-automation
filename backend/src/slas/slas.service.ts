import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSlaDto } from './dto/update-sla.dto';

@Injectable()
export class SlasService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.sla.findMany({ orderBy: { resolutionMinutes: 'asc' } });
  }

  async update(id: string, dto: UpdateSlaDto) {
    const sla = await this.prisma.sla.findUnique({ where: { id } });
    if (!sla) {
      throw new NotFoundException('Aturan SLA tidak ditemukan');
    }
    // Catatan: perubahan hanya berlaku untuk tiket BARU (deadline sudah terhitung saat create)
    return this.prisma.sla.update({
      where: { id },
      data: {
        ...(dto.responseMinutes !== undefined
          ? { responseMinutes: dto.responseMinutes }
          : {}),
        ...(dto.resolutionMinutes !== undefined
          ? { resolutionMinutes: dto.resolutionMinutes }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
