import { TicketPriority, TicketStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListTicketsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'priority'])
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' = 'createdAt';

  /** all = semua tiket (agen/admin), mine = milik saya — END_USER selalu dibatasi sendiri */
  @IsOptional()
  @IsIn(['all', 'mine', 'unassigned'])
  scope?: 'all' | 'mine' | 'unassigned' = 'all';

  /** Filter tiket dibuat mulai tanggal (ISO 8601 date string, e.g. 2024-01-15) */
  @IsOptional()
  @IsString()
  dateFrom?: string;

  /** Filter tiket dibuat sampai tanggal (ISO 8601 date string, e.g. 2024-12-31) */
  @IsOptional()
  @IsString()
  dateTo?: string;
}
