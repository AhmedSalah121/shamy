import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Resolver(() => Notification)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Query: Get notifications by receiver
  @Query(() => [Notification], { name: 'userNotifications' })
  async getUserNotifications(@Args('reciever') reciever: string): Promise<Notification[]> {
    return this.notificationsService.getUserNotifications(reciever);
  }

  // Mutation: Create notification in SQLite
  @Mutation(() => Notification)
  async createNotification(
    @Args() dto: CreateNotificationDto,
  ): Promise<Notification> {
    return this.notificationsService.createNotification(dto);
  }
}
