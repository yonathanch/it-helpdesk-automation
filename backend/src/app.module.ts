import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { CategoriesModule } from './categories/categories.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SlasModule } from './slas/slas.module';
import { SlaCheckModule } from './slas/sla-check.module';
import { StorageModule } from './storage/storage.module';
import { TicketsModule } from './tickets/tickets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    StorageModule,
    NotificationsModule,
    AuthModule,
    TicketsModule,
    CategoriesModule,
    SlasModule,
    SlaCheckModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Urutan penting: auth dulu, baru cek role
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
