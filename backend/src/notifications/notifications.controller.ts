import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationDto } from '../common/dto/api.dto';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: 'Token tidak ditemukan atau tidak valid',
})
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @SkipThrottle()
  @Get()
  @ApiOperation({
    summary: 'Daftar notifikasi',
    description: 'Maksimal 50 notifikasi terbaru milik pengguna yang login.',
  })
  @ApiQuery({
    name: 'unread',
    description: 'true = hanya notifikasi yang belum dibaca',
    required: false,
  })
  @ApiOkResponse({ type: [NotificationDto] })
  list(@CurrentUser('sub') userId: string, @Query('unread') unread?: string) {
    return this.notifications.list(userId, unread === 'true');
  }

  @SkipThrottle()
  @Get('unread-count')
  @ApiOperation({
    summary: 'Jumlah notifikasi belum dibaca',
    description: 'Dipakai klien untuk badge lonceng notifikasi.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { count: { type: 'number', example: 3 } },
    },
  })
  count(@CurrentUser('sub') userId: string) {
    return this.notifications.countUnread(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Tandai satu notifikasi sudah dibaca' })
  @ApiOkResponse({ type: NotificationDto })
  @ApiNotFoundResponse({
    description: 'Notifikasi tidak ditemukan atau bukan milik pengguna ini',
  })
  markRead(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.notifications.markRead(id, userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Tandai semua notifikasi sudah dibaca' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { updated: { type: 'number', example: 5 } },
    },
  })
  markAllRead(@CurrentUser('sub') userId: string) {
    return this.notifications.markAllRead(userId);
  }
}
