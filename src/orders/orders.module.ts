import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderAdmin } from './entities/order-admin.entity';
import { OrderParticipant } from './entities/order-participant.entity';
import { OrderItem } from './entities/order-item.entity';
import { Reimbursement } from './entities/reimbursement.entity';
import { OrderFrontPayer } from './entities/order-front-payer.entity';
import { User } from '../users/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderAdmin,
      OrderParticipant,
      OrderItem,
      Reimbursement,
      OrderFrontPayer,
      User,
    ]),
    NotificationsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
