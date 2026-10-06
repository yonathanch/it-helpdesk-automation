import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { CategoriesModule } from './categories/categories.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SlasModule } from './slas/slas.module';
import { SlaCheckModule } from './slas/sla-check.module';
import { StorageModule } from './storage/storage.module';
import { TicketsModule } from './tickets/tickets.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ReportingModule } from './reporting/reporting.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UsersModule } from './users/users.module';
import { GlobalExceptionFilter } from './common/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    // Rate limiting: sangat longgar untuk aplikasi internal helpdesk
    // Fokus mencegah spam brute-force, bukan membatasi penggunaan normal
    PrismaModule,
    StorageModule,
    NotificationsModule,
    AiModule,
    AuthModule,
    TicketsModule,
    CategoriesModule,
    SlasModule,
    SlaCheckModule,
    KnowledgeModule,
    WebhooksModule,
    ReportingModule,
    RealtimeModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global exception filter (standardize error response format)
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    // Urutan penting: auth dulu, baru role
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
