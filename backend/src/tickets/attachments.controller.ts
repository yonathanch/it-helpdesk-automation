import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from './tickets.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TicketsService } from './tickets.service';

@ApiTags('Tickets')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: 'Token tidak ditemukan atau tidak valid',
})
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get(':id/download')
  @ApiOperation({
    summary: 'Unduh lampiran',
    description:
      'Mengembalikan file sebagai stream. Klien harus mengirim header `Authorization: Bearer <token>` karena respons berupa biner, bukan JSON.',
  })
  @ApiParam({ name: 'id', description: 'ID lampiran' })
  @ApiOkResponse({
    description: 'Berkas lampiran',
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Lampiran tidak ditemukan' })
  @ApiForbiddenResponse({
    description: 'Lampiran milik tiket yang tidak dapat diakses pengguna ini',
  })
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StreamableFile> {
    const { filename, mimeType, stream } =
      await this.ticketsService.downloadAttachment(id, user);

    return new StreamableFile(stream, {
      type: mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
