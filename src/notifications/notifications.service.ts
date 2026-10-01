import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    const notification = new Notification(dto.sender, dto.reciever);
    return this.notificationRepository.save(notification);
  }

  async getUserNotifications(reciever: string): Promise<Notification[]> {
    return this.notificationRepository.find({ where: { reciever }});
  }

  async markAsRead(id: number): Promise<Notification | null> {
    const notification = await this.notificationRepository.findOne({ where: { id }});
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    notification.read_at = new Date();
    return await this.notificationRepository.save(notification);
  }
}
