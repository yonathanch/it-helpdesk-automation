import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import type { AuthUser } from './tickets.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TicketsService } from './tickets.service';

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get(':id/download')
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
