import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  controllers: [TicketsController, AttachmentsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
