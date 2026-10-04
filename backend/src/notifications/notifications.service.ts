import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, Role } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

export interface EmailJob {
  to: string;
  subject: string;
  body: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  readonly emailQueue: Queue<EmailJob>;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.emailQueue = new Queue<EmailJob>('email', {
      connection: {
        host: config.get<string>('REDIS_HOST') ?? 'localhost',
        port: Number.parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10),
        maxRetriesPerRequest: null,
      },
    });
  }

  /** Notifikasi in-app + email sekaligus */
  async notify(
    userId: string,
    input: {
      type: NotificationType;
      title: string;
      body: string;
      ticketId?: string;
    },
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        ticketId: input.ticketId,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (user) {
      await this.emailQueue.add('send', {
        to: user.email,
        subject: `[IT Help Desk] ${input.title}`,
        body: input.body,
      });
    }

    return notification;
  }

  /** Notifikasi ke semua user dengan role tertentu (tanpa email massal) */
  async notifyByRole(
    roles: Role[],
    input: {
      type: NotificationType;
      title: string;
      body: string;
      ticketId?: string;
    },
  ) {
    const users = await this.prisma.user.findMany({
      where: { role: { in: roles }, isActive: true },
      select: { id: true },
    });
    return Promise.all(
      users.map((u) =>
        this.prisma.notification.create({
          data: {
            userId: u.id,
            type: input.type,
            title: input.title,
            body: input.body,
            ticketId: input.ticketId,
          },
        }),
      ),
    );
  }

  async list(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        ticket: { select: { id: true, code: true, title: true } },
      },
    });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notifikasi tidak ditemukan');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: notification.readAt ?? new Date() },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async countUnread(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async onModuleDestroy() {
    await this.emailQueue.close();
    this.logger.log('Email queue ditutup');
  }
}
