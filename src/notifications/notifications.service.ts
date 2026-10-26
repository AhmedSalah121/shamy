import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { Notification } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    return await this.prisma.notification.create({
      data: {
        sender: dto.sender,
        reciever: dto.reciever,
      },
    });
  }

  async getUserNotifications(reciever: string): Promise<Notification[]> {
    return await this.prisma.notification.findMany({
      where: {
        reciever,
        deleted_at: null,
      },
    });
  }

  async markAsRead(id: number): Promise<Notification | null> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, deleted_at: null },
    });
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return await this.prisma.notification.update({
      where: { id },
      data: {
        read_at: new Date(),
      },
    });
  }
}
