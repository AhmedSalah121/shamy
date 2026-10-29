import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { Notification, User } from '@prisma/client';

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

  async getUserNotificationsForUser(user: User): Promise<any[]> {
    const targets = [String(user.id)];
    if (user.email) {
      targets.push(user.email);
      targets.push(user.email.toLowerCase());
    }

    const list = await this.prisma.notification.findMany({
      where: {
        reciever: { in: targets },
        deleted_at: null,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
    return this.formatNotifications(list);
  }

  private formatNotifications(list: Notification[]): any[] {
    return list.map((n) => ({
      id: n.id,
      sender: n.sender,
      reciever: n.reciever,
      title: n.sender || 'Update',
      message: n.sender ? `${n.sender}` : 'New notification',
      createdAt: n.created_at,
      readAt: n.read_at,
      read_at: n.read_at,
      created_at: n.created_at,
    }));
  }

  async markAsRead(id: number, user: User): Promise<any> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, deleted_at: null },
    });
    if (!notification) {
      throw new NotFoundException(`Notification #${id} not found`);
    }

    const isOwner =
      notification.reciever === String(user.id) ||
      (user.email &&
        notification.reciever.toLowerCase() === user.email.toLowerCase());

    if (!isOwner) {
      throw new ForbiddenException(
        'You do not have permission to modify this notification',
      );
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        read_at: new Date(),
      },
    });

    return {
      success: true,
      notification: updated,
    };
  }
}
