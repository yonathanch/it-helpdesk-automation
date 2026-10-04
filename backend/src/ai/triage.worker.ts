import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { TriageService } from './triage.service';
import type { TriageJob } from './ai.service';

/** Worker antrian ai-triage: memproses tiket baru di background */
@Injectable()
export class TriageWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TriageWorker.name);
  private readonly worker: Worker<TriageJob>;

  constructor(
    private readonly triage: TriageService,
    config: ConfigService,
  ) {
    this.worker = new Worker<TriageJob>(
      'ai-triage',
      async (job) => this.triage.triage(job.data.ticketId),
      {
        connection: {
          host: config.get<string>('REDIS_HOST') ?? 'localhost',
          port: Number.parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10),
          maxRetriesPerRequest: null,
        },
      },
    );
    this.worker.on('completed', (job) =>
      this.logger.log(`Triage ${job.data.ticketId} selesai`),
    );
    this.worker.on('failed', (job, err) =>
      this.logger.warn(`Triage ${job?.data.ticketId} gagal: ${err.message}`),
    );
  }

  onModuleInit() {
    this.logger.log('Triage worker siap menerima job ai-triage');
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
