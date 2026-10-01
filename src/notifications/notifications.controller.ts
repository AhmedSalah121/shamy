import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @Post('send')
  sendNotification(@Body() dto: CreateNotificationDto) {
    // Triggers both the database write and real-time socket delivery
    return this.notificationsGateway.sendNotificationToUser(dto);
  }

  @Get(':user')
  getUserNotifications(@Param('user') user: string) {
    return this.notificationsService.getUserNotifications(user);
  }

  @Post(':id/read')
  markAsRead(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.markAsRead(id);
  }
}
