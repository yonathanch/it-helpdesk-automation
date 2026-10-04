import { Global, Module } from '@nestjs/common';
import { EmailWorker } from './email.worker';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailWorker],
  exports: [NotificationsService],
})
export class NotificationsModule {}
