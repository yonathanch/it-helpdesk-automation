import { Global, Module } from '@nestjs/common';
import { WebhookWorker } from './webhook.worker';
import { WebhooksService } from './webhooks.service';

@Global()
@Module({
  providers: [WebhooksService, WebhookWorker],
  exports: [WebhooksService],
})
export class WebhooksModule {}
