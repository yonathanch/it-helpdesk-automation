import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { UpdateSlaDto } from './dto/update-sla.dto';
import { SlasService } from './slas.service';
import { SlaDto } from '../common/dto/api.dto';

@ApiTags('SLA')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: 'Token tidak ditemukan atau tidak valid',
})
@Controller('slas')
export class SlasController {
  constructor(private readonly slas: SlasService) {}

  @Get()
  @ApiOperation({
    summary: 'Daftar aturan SLA',
    description:
      'Satu aturan SLA per prioritas (`LOW`, `MEDIUM`, `HIGH`, `URGENT`). Dipakai backend untuk menghitung `slaDueAt` setiap tiket.',
  })
  @ApiOkResponse({ type: [SlaDto] })
  findAll() {
    return this.slas.findAll();
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Ubah aturan SLA',
    description:
      'Hanya administrator yang boleh mengubah target waktu layanan.',
  })
  @ApiOkResponse({ type: SlaDto })
  @ApiForbiddenResponse({ description: 'Hanya ADMIN' })
  update(@Param('id') id: string, @Body() dto: UpdateSlaDto) {
    return this.slas.update(id, dto);
  }
}
