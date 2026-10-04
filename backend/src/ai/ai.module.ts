import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { TriageService } from './triage.service';
import { TriageWorker } from './triage.worker';

@Global()
@Module({
  providers: [AiService, TriageService, TriageWorker],
  exports: [AiService, TriageService],
})
export class AiModule {}
