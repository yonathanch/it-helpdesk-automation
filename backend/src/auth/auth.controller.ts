import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from './public.decorator';
import { AuthResponseDto } from '../common/dto/api.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({
    summary: 'Daftar pengguna baru',
    description:
      'Membuat akun dengan peran `END_USER`. Peran `AGENT`/`ADMIN` hanya bisa dibuat oleh administrator.',
  })
  @ApiCreatedResponse({
    description: 'Akun berhasil dibuat',
    type: AuthResponseDto,
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Login dan terima token JWT' })
  @ApiOkResponse({ description: 'Login berhasil', type: AuthResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Email/password salah atau akun nonaktif',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Tukar refresh token menjadi token baru',
    description:
      'Memvalidasi refresh token dan mengembalikan access + refresh token baru. Dipakai klien saat access token (15 menit) kedaluwarsa.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token tidak valid' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Profil pengguna yang sedang login' })
  @ApiOkResponse({
    description: 'Data user aktif',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'cmut4ns740001fvkcuxopew7o' },
        name: { type: 'string', example: 'Siti Rahma' },
        email: { type: 'string', example: 'user@helpdesk.local' },
        role: { type: 'string', enum: ['ADMIN', 'AGENT', 'END_USER'] },
        department: { type: 'string', nullable: true, example: 'Finance' },
        isActive: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Token tidak ditemukan, tidak valid, atau kedaluwarsa',
  })
  me(@CurrentUser('sub') userId: string) {
    return this.authService.me(userId);
  }
}
