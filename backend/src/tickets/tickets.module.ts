import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AttachmentsController } from './attachments.controller';
import { DraftService } from './draft.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [KnowledgeModule],
  controllers: [TicketsController, AttachmentsController],
  providers: [TicketsService, DraftService],
  exports: [TicketsService],
})
export class TicketsModule {}
