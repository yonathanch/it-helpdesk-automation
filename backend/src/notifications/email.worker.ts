import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { EmailJob } from './notifications.service';

/**
 * Worker email berjalan di Redis queue.
 * - SMTP_HOST di-set  → kirim via SMTP sungguhan
 * - tanpa SMTP        → mode dev: log isi email ke console
 */
@Injectable()
export class EmailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailWorker.name);
  private worker?: Worker<EmailJob>;
  private transporter?: nodemailer.Transporter;
  private readonly smtpHost?: string;

  constructor(config: ConfigService) {
    this.smtpHost = config.get<string>('SMTP_HOST');
    const smtpPort = Number.parseInt(
      config.get<string>('SMTP_PORT') ?? '587',
      10,
    );

    if (this.smtpHost) {
      this.transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: config.get('SMTP_USER')
          ? {
              user: config.get<string>('SMTP_USER'),
              pass: config.get<string>('SMTP_PASS'),
            }
          : undefined,
      });
      this.logger.log(`SMTP aktif: ${this.smtpHost}:${smtpPort}`);
    } else {
      this.logger.warn(
        'SMTP_HOST tidak di-set — mode DEV: email dicetak ke log, tidak dikirim',
      );
    }

    this.worker = new Worker<EmailJob>(
      'email',
      async (job) => this.send(job.data),
      {
        connection: {
          host: config.get<string>('REDIS_HOST') ?? 'localhost',
          port: Number.parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10),
          maxRetriesPerRequest: null,
        },
      },
    );

    this.worker.on('completed', (job) =>
      this.logger.log(`Email job ${job.id} selesai → ${job.data.to}`),
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Email job ${job?.id} gagal: ${err.message}`),
    );
  }

  onModuleInit() {
    this.logger.log('Email worker siap menerima job dari Redis');
  }

  private async send(job: EmailJob): Promise<void> {
    if (this.transporter) {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM ?? 'helpdesk@localhost',
        to: job.to,
        subject: job.subject,
        text: job.body,
      });
      return;
    }
    // Mode dev
    this.logger.log(
      `📧 [DEV EMAIL] ke=${job.to} | subjek="${job.subject}" | ${job.body}`,
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
