import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from './entities/notification.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly notificationsService: NotificationsService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }
  // Clients emit this upon connecting to register their user ID
  @SubscribeMessage('register_user')
  async handleRegisterUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() userId: string,
  ) {
    await client.join(String(userId));
    return { status: 'joined', room: String(userId) };
  }

  // Clients emit this to receive real-time updates for a specific order
  @SubscribeMessage('join_order')
  async handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() orderId: number | string,
  ) {
    const room = `order_${orderId}`;
    await client.join(room);
    return { status: 'joined', room };
  }

  // Broadcasts event to all participants listening to a specific order and globally for front-page updates
  broadcastToOrder(orderId: number | string, event: string, data: any) {
    if (this.server) {
      this.server.to(`order_${orderId}`).emit(event, data);
      this.server.emit(event, data);
    }
  }

  // Broadcasts event globally to all connected clients (e.g. front-page active orders)
  broadcastGlobal(event: string, data: any) {
    if (this.server) {
      this.server.emit(event, data);
    }
  }

  async sendNotificationToUser(dto: CreateNotificationDto): Promise<Notification> {
    const notification = await this.notificationsService.createNotification(dto);

    // Broadcast to the room matching the receiver's ID
    if (this.server) {
      this.server.to(String(dto.reciever)).emit('new_notification', notification);
    }

    return notification;
  }
}
