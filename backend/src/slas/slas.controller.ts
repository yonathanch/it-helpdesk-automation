import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { UpdateSlaDto } from './dto/update-sla.dto';
import { SlasService } from './slas.service';

@Controller('slas')
export class SlasController {
  constructor(private readonly slas: SlasService) {}

  @Get()
  findAll() {
    return this.slas.findAll();
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateSlaDto) {
    return this.slas.update(id, dto);
  }
}
