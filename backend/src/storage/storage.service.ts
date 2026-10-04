import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'stream';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: Client;
  private readonly bucket: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(config: ConfigService) {
    this.client = new Client({
      endPoint: config.get<string>('MINIO_ENDPOINT') ?? 'localhost',
      port: Number.parseInt(config.get<string>('MINIO_PORT') ?? '9000', 10),
      useSSL: false,
      accessKey: config.get<string>('MINIO_ACCESS_KEY') ?? 'minioadmin',
      secretKey: config.get<string>('MINIO_SECRET_KEY') ?? 'minioadmin123',
    });
    this.bucket = config.get<string>('MINIO_BUCKET') ?? 'helpdesk-attachments';
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket "${this.bucket}" dibuat`);
      }
    } catch (err) {
      this.logger.warn(`MinIO tidak tersedia saat startup: ${String(err)}`);
    }
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.putObject(this.bucket, key, body, body.length, {
        'Content-Type': contentType,
      });
    } catch (err) {
      this.logger.error(`Gagal upload ${key}: ${String(err)}`);
      throw new ServiceUnavailableException('Gagal mengupload file ke storage');
    }
  }

  async download(key: string): Promise<Readable> {
    try {
      return await this.client.getObject(this.bucket, key);
    } catch (err) {
      this.logger.error(`Gagal download ${key}: ${String(err)}`);
      throw new ServiceUnavailableException(
        'Gagal mengambil file dari storage',
      );
    }
  }
}
