import { Role } from '@prisma/client';
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

/**
 * Query untuk GET /users (ADMIN).
 *
 * `isActive` sengaja bertipe string "true"/"false", bukan boolean: nilainya
 * datang dari query string, dan `@Type(() => Boolean)` akan salah membaca
 * "false" sebagai true (string non-kosong selalu truthy).
 */
export class ListUsersQueryDto {
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
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: string;

  /** Cari berdasarkan nama, email, atau departemen. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';

  @IsOptional()
  @IsIn(['name', 'email', 'createdAt', 'role'])
  sortBy?: 'name' | 'email' | 'createdAt' | 'role' = 'name';
}

/** Ubah filter string dari query menjadi boolean sungguhan. */
export function parseIsActive(value?: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}
