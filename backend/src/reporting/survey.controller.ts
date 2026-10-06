import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { SurveyService } from './survey.service';
import type { AccessTokenPayload } from '../auth/auth.service';

export class SubmitSurveyDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

@ApiTags('Reporting')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: 'Token tidak ditemukan atau tidak valid',
})
@Controller('surveys')
export class SurveyController {
  constructor(private readonly surveys: SurveyService) {}

  @Post('tickets/:ticketId')
  @ApiOperation({
    summary: 'Beri penilaian kepuasan (CSAT)',
    description: [
      'Hanya **pelapor tiket** yang boleh menilai, dan hanya setelah tiket selesai',
      '(RESOLVED/CLOSED). Satu tiket hanya bisa dinilai satu kali.',
      '',
      'Rating 1 (sangat tidak puas) sampai 5 (sangat puas).',
    ].join('\n'),
  })
  @ApiCreatedResponse({ description: 'Penilaian tersimpan' })
  @ApiForbiddenResponse({ description: 'Bukan pelapor tiket ini' })
  @ApiBadRequestResponse({
    description: 'Rating di luar 1–5, atau tiket belum selesai',
  })
  @ApiConflictResponse({ description: 'Tiket sudah pernah dinilai' })
  @ApiNotFoundResponse({ description: 'Tiket tidak ditemukan' })
  submit(
    @Param('ticketId') ticketId: string,
    @Body() dto: SubmitSurveyDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.surveys.submit({
      ticketId,
      userId: user.sub,
      role: user.role,
      rating: dto.rating,
      comment: dto.comment,
    });
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Daftar penilaian CSAT (admin)',
    description: 'Penilaian terbaru beserta tiket dan nama pelapor.',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Jumlah hasil (1–100, default 50)',
    required: false,
  })
  @ApiOkResponse({ description: 'Daftar penilaian' })
  @ApiForbiddenResponse({ description: 'Hanya ADMIN' })
  list(@Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '50', 10);
    return this.surveys.list(Number.isNaN(parsed) ? 50 : parsed);
  }
}
