import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser('sub') userId: string, @Query('unread') unread?: string) {
    return this.notifications.list(userId, unread === 'true');
  }

  @Get('unread-count')
  count(@CurrentUser('sub') userId: string) {
    return this.notifications.countUnread(userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.notifications.markRead(id, userId);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser('sub') userId: string) {
    return this.notifications.markAllRead(userId);
  }
}
