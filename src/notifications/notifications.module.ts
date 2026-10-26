import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { NotificationsController } from './notifications.controller.js';

@Module({
  imports: [],
  providers: [NotificationsGateway, NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
