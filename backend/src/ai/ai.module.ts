import { Global, Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AiService } from './ai.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { RoutingService } from './routing.service';
import { TriageService } from './triage.service';
import { TriageWorker } from './triage.worker';

@Global()
@Module({
  imports: [KnowledgeModule],
  controllers: [ChatController],
  providers: [
    AiService,
    TriageService,
    TriageWorker,
    ChatService,
    RoutingService,
  ],
  exports: [AiService, TriageService, ChatService, RoutingService],
})
export class AiModule {}
