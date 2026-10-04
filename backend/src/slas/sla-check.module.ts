import { Module } from '@nestjs/common';
import { SlaCheckJob } from './sla-check.job';

@Module({
  providers: [SlaCheckJob],
})
export class SlaCheckModule {}
