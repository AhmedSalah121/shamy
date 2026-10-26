import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { UploadsModule } from './uploads/uploads.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    NotificationsModule,
    AuthModule,
    OrdersModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
