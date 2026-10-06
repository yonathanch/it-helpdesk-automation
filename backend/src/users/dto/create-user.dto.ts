import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * POST /users (ADMIN).
 *
 * Ini satu-satunya cara membuat akun AGENT/ADMIN — pendaftaran publik
 * (/auth/register) selalu menghasilkan END_USER.
 */
export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter' })
  @MaxLength(72, {
    message: 'Password maksimal 72 karakter (batas aman bcrypt)',
  })
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;
}
