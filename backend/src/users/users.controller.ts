import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import {
  AgentOptionDto,
  AdminUserDto,
  UserListDto,
} from '../common/dto/api.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: 'Token tidak ditemukan atau tidak valid',
})
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * Diletakkan SEBELUM rute ber-parameter lain supaya "agents" tidak
   * tertangkap sebagai sebuah id.
   */
  @SkipThrottle()
  @Get('agents')
  @Roles(Role.AGENT, Role.ADMIN)
  @ApiOperation({
    summary: 'Daftar agen aktif untuk penugasan tiket',
    description: [
      'Hanya AGENT/ADMIN aktif. `activeTickets` adalah jumlah tiket yang',
      'belum selesai dan sedang ditangani agen tersebut — berguna untuk',
      'melihat beban kerja sebelum menugaskan tiket baru.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [AgentOptionDto] })
  @ApiForbiddenResponse({ description: 'Hanya AGENT/ADMIN' })
  listAgents() {
    return this.users.listAgents();
  }

  @SkipThrottle()
  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Daftar pengguna',
    description:
      'Mendukung filter role, status aktif, pencarian, pengurutan, dan paginasi. Field `passwordHash` tidak pernah dikembalikan.',
  })
  @ApiOkResponse({ type: UserListDto })
  @ApiForbiddenResponse({ description: 'Hanya ADMIN' })
  findAll(@Query() query: ListUsersQueryDto) {
    return this.users.findAll(query);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Buat pengguna baru (termasuk Agen/Admin)',
    description:
      'Satu-satunya cara membuat akun berperan AGENT atau ADMIN. Pendaftaran publik lewat POST /auth/register selalu menghasilkan END_USER.',
  })
  @ApiCreatedResponse({ type: AdminUserDto })
  @ApiForbiddenResponse({ description: 'Hanya ADMIN' })
  @ApiConflictResponse({ description: 'Email sudah terdaftar' })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Ubah pengguna (nama, departemen, role, status aktif)',
    description: [
      'Dijaga dari keadaan terkunci:',
      '- Admin aktif terakhir tidak bisa diturunkan atau dinonaktifkan.',
      '- Admin tidak bisa mengubah role atau menonaktifkan akunnya sendiri.',
      '',
      'Email tidak bisa diubah agar riwayat tiket tetap menunjuk orang yang sama.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiForbiddenResponse({ description: 'Hanya ADMIN' })
  @ApiNotFoundResponse({ description: 'Pengguna tidak ditemukan' })
  @ApiBadRequestResponse({
    description: 'Perubahan tidak diizinkan atau tidak ada perubahan',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('sub') currentUserId: string,
  ) {
    return this.users.update(id, dto, currentUserId);
  }
}
