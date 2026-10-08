import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { User } from './users/user.entity';
import { Notification } from './notifications/entities/notification.entity';
import { Order } from './orders/entities/order.entity';
import { OrderAdmin } from './orders/entities/order-admin.entity';
import { OrderParticipant } from './orders/entities/order-participant.entity';
import { OrderItem } from './orders/entities/order-item.entity';
import { Reimbursement } from './orders/entities/reimbursement.entity';
import { OrderFrontPayer } from './orders/entities/order-front-payer.entity';

import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'database.sqlite',
      entities: [
        User,
        Notification,
        Order,
        OrderAdmin,
        OrderParticipant,
        OrderItem,
        Reimbursement,
        OrderFrontPayer,
      ],
      autoLoadEntities: true,
      synchronize: true,
    }),
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
