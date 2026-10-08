import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';

import { Order, OrderStatus, OrderVisibility } from './entities/order.entity';
import { OrderAdmin } from './entities/order-admin.entity';
import { OrderParticipant } from './entities/order-participant.entity';
import { OrderItem } from './entities/order-item.entity';
import { Reimbursement, ReimbursementStatus, PaymentMethod } from './entities/reimbursement.entity';
import { OrderFrontPayer } from './entities/order-front-payer.entity';
import { User } from '../users/user.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway';

import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JoinOrderDto } from './dto/join-order.dto';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { PayCashDto } from './dto/reimbursement.dto';
import { AddFrontPayerDto } from './dto/front-payer.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderAdmin)
    private readonly adminRepo: Repository<OrderAdmin>,
    @InjectRepository(OrderParticipant)
    private readonly participantRepo: Repository<OrderParticipant>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(Reimbursement)
    private readonly reimbursementRepo: Repository<Reimbursement>,
    @InjectRepository(OrderFrontPayer)
    private readonly frontPayerRepo: Repository<OrderFrontPayer>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly gateway: NotificationsGateway,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. Order Creation & Listing
  // ---------------------------------------------------------------------------

  async createOrder(creatorId: number, dto: CreateOrderDto): Promise<any> {
    const inviteCode =
      dto.visibility === OrderVisibility.VIP
        ? crypto.randomBytes(6).toString('hex')
        : undefined;

    const order = this.orderRepo.create({
      title: dto.title,
      description: dto.description,
      visibility: dto.visibility || OrderVisibility.PUBLIC,
      vipPassword: dto.vipPassword,
      vipInviteCode: inviteCode,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      deliveryFee: dto.deliveryFee ?? 0,
      serviceFee: dto.serviceFee ?? 0,
      discount: dto.discount ?? 0,
      restaurantName: dto.restaurantName,
      restaurantPhone: dto.restaurantPhone,
      menuUrl: dto.menuUrl,
      menuImageUrl: dto.menuImageUrl,
      hideParticipantItems: dto.hideParticipantItems ?? false,
      creatorId,
      pickupHeroId: dto.pickupHeroId,
      status: OrderStatus.OPEN,
    });

    const savedOrder = await this.orderRepo.save(order);

    // Auto-join creator as initial participant
    await this.participantRepo.save(
      this.participantRepo.create({
        orderId: savedOrder.id,
        userId: creatorId,
      }),
    );

    this.gateway.broadcastGlobal('order_created', {
      orderId: savedOrder.id,
      title: savedOrder.title,
      restaurantName: savedOrder.restaurantName,
      creatorId,
    });

    return this.getOrderDetails(savedOrder.id, creatorId);
  }

  async getOrders(userId?: number): Promise<Order[]> {
    const query = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.creator', 'creator')
      .leftJoinAndSelect('order.pickupHero', 'pickupHero')
      .leftJoinAndSelect('order.admins', 'admins')
      .leftJoinAndSelect('admins.user', 'adminUser')
      .leftJoinAndSelect('order.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'participantUser')
      .orderBy('order.createdAt', 'DESC');

    if (userId) {
      query.where(
        'order.visibility = :public OR order.creatorId = :userId OR admins.userId = :userId OR participants.userId = :userId',
        { public: OrderVisibility.PUBLIC, userId },
      );
    } else {
      query.where('order.visibility = :public', { public: OrderVisibility.PUBLIC });
    }

    const orders = await query.getMany();
    return orders.map((o) => {
      const { vipPassword: _vipPassword, ...safe } = o;
      return safe as Order;
    });
  }

  async getOrderDetails(orderId: number, requestingUserId?: number): Promise<any> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: {
        creator: true,
        pickupHero: true,
        admins: { user: true },
        participants: { user: true },
        items: { participant: { user: true } },
        frontPayers: { user: true },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    const isCreator = requestingUserId === order.creatorId;
    const isAdmin = order.admins?.some((a) => a.userId === requestingUserId);
    const isParticipant = order.participants?.some((p) => p.userId === requestingUserId);

    // VIP protection check
    if (order.visibility === OrderVisibility.VIP && !isCreator && !isAdmin && !isParticipant) {
      throw new ForbiddenException('This is a private VIP order. Please join using the invite link or passcode.');
    }

    // Sanitize VIP password
    const { vipPassword: _vipPassword, ...safeOrder } = order;

    // Filter items belonging to requesting user
    const myItems = requestingUserId
      ? (order.items || [])
          .filter((item) => item.participant?.userId === requestingUserId)
          .map((i) => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: Math.round(i.unitPrice * i.quantity * 100) / 100,
            notes: i.notes,
            createdAt: i.createdAt,
          }))
      : [];

    const myItemsTotal = myItems.reduce((acc, i) => acc + i.totalPrice, 0);

    const isDeadlinePassed = order.deadline ? new Date() > new Date(order.deadline) : false;

    // Apply Participant Privacy filter if enabled and user is not Admin/Creator
    if (order.hideParticipantItems && !isCreator && !isAdmin) {
      const filteredItems = (order.items || []).filter(
        (item) => item.participant?.userId === requestingUserId,
      );

      const filteredParticipants = (order.participants || []).map((p) => {
        if (p.userId !== requestingUserId) {
          return {
            id: p.id,
            userId: p.userId,
            user: p.user
              ? {
                  id: p.user.id,
                  name: p.user.name,
                  avatar: p.user.avatar,
                  instapayHandle: p.user.instapayHandle,
                }
              : null,
            joinedAt: p.joinedAt,
            itemsCount: (order.items || []).filter((i) => i.participantId === p.id).length,
          };
        }
        return p;
      });

      return {
        ...safeOrder,
        items: filteredItems,
        participants: filteredParticipants,
        myItems,
        myItemsTotal: Math.round(myItemsTotal * 100) / 100,
        isDeadlinePassed,
        userRole: isCreator ? 'CREATOR' : isAdmin ? 'ADMIN' : isParticipant ? 'PARTICIPANT' : 'GUEST',
      };
    }

    return {
      ...safeOrder,
      myItems,
      myItemsTotal: Math.round(myItemsTotal * 100) / 100,
      isDeadlinePassed,
      userRole: isCreator ? 'CREATOR' : isAdmin ? 'ADMIN' : isParticipant ? 'PARTICIPANT' : 'GUEST',
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Order Management (Update, Status, Admins, Lock, Settle)
  // ---------------------------------------------------------------------------

  async updateOrder(orderId: number, userId: number, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.getOrderForManagement(orderId, userId);

    if (dto.title !== undefined) order.title = dto.title;
    if (dto.description !== undefined) order.description = dto.description;
    if (dto.visibility !== undefined) order.visibility = dto.visibility;
    if (dto.vipPassword !== undefined) order.vipPassword = dto.vipPassword;
    if (dto.deadline !== undefined) order.deadline = dto.deadline ? new Date(dto.deadline) : undefined;
    if (dto.deliveryFee !== undefined) order.deliveryFee = dto.deliveryFee;
    if (dto.serviceFee !== undefined) order.serviceFee = dto.serviceFee;
    if (dto.discount !== undefined) order.discount = dto.discount;
    if (dto.restaurantName !== undefined) order.restaurantName = dto.restaurantName;
    if (dto.restaurantPhone !== undefined) order.restaurantPhone = dto.restaurantPhone;
    if (dto.menuUrl !== undefined) order.menuUrl = dto.menuUrl;
    if (dto.menuImageUrl !== undefined) order.menuImageUrl = dto.menuImageUrl;
    if (dto.hideParticipantItems !== undefined) order.hideParticipantItems = dto.hideParticipantItems;
    if (dto.pickupPersonId !== undefined) order.pickupHeroId = dto.pickupPersonId;

    const saved = await this.orderRepo.save(order);
    this.gateway.broadcastToOrder(orderId, 'order_updated', { orderId, order: saved });
    return saved;
  }

  async updateStatus(
    orderId: number,
    userId: number,
    newStatus: OrderStatus,
    fee?: number,
  ): Promise<{ order: Order; bills?: any }> {
    const order = await this.getOrderForManagement(orderId, userId);
    order.status = newStatus;

    if (fee !== undefined && fee !== null) {
      order.deliveryFee = fee;
    }

    // Auto-pick a Pickup Hero if order locks or transitions and none was picked yet
    if (
      !order.pickupHeroId &&
      (newStatus === OrderStatus.LOCKED ||
        newStatus === OrderStatus.ORDERED ||
        newStatus === OrderStatus.SETTLING)
    ) {
      await this.tryAutoAssignPickupHero(order);
    }

    const saved = await this.orderRepo.save(order);

    let bills: any = null;
    if (newStatus === OrderStatus.SETTLING) {
      bills = await this.calculateBillBreakdown(orderId);
      this.gateway.broadcastToOrder(orderId, 'order_settling', {
        orderId,
        status: newStatus,
        bills,
      });
      this.gateway.broadcastGlobal('order_settling', {
        orderId,
        status: newStatus,
        bills,
      });
    } else {
      this.gateway.broadcastToOrder(orderId, 'status_changed', { orderId, status: newStatus });
      this.gateway.broadcastGlobal('status_changed', { orderId, status: newStatus });
    }

    return { order: saved, bills };
  }

  async lockOrder(orderId: number, userId: number): Promise<Order> {
    const result = await this.updateStatus(orderId, userId, OrderStatus.LOCKED);
    return result.order;
  }

  async assignAdmin(orderId: number, creatorId: number, targetUserId: number): Promise<OrderAdmin> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);
    if (order.creatorId !== creatorId) {
      throw new ForbiddenException('Only the order creator can assign co-admins');
    }

    const targetUser = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!targetUser) throw new NotFoundException(`User #${targetUserId} not found`);

    const existingAdmin = await this.adminRepo.findOne({
      where: { orderId, userId: targetUserId },
    });

    if (existingAdmin) return existingAdmin;

    const admin = this.adminRepo.create({ orderId, userId: targetUserId });
    const saved = await this.adminRepo.save(admin);

    this.gateway.broadcastToOrder(orderId, 'admin_assigned', { orderId, userId: targetUserId });
    return saved;
  }

  async removeAdmin(orderId: number, creatorId: number, targetUserId: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);
    if (order.creatorId !== creatorId) {
      throw new ForbiddenException('Only the order creator can remove co-admins');
    }

    await this.adminRepo.delete({ orderId, userId: targetUserId });
    this.gateway.broadcastToOrder(orderId, 'admin_removed', { orderId, userId: targetUserId });
  }

  // ---------------------------------------------------------------------------
  // 3. Joining & Participating in Orders
  // ---------------------------------------------------------------------------

  async joinOrder(orderId: number, userId: number, dto: JoinOrderDto): Promise<OrderParticipant> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException(`Cannot join order in ${order.status} status`);
    }

    if (order.deadline && new Date() > new Date(order.deadline)) {
      throw new BadRequestException('Order deadline has passed. Cannot join order.');
    }

    // Check VIP Access
    if (order.visibility === OrderVisibility.VIP && order.creatorId !== userId) {
      const matchesInvite = dto.inviteCode && dto.inviteCode === order.vipInviteCode;
      const matchesPassword = dto.vipPassword && dto.vipPassword === order.vipPassword;

      if (!matchesInvite && !matchesPassword) {
        throw new ForbiddenException('Invalid VIP passcode or invitation code');
      }
    }

    let participant = await this.participantRepo.findOne({
      where: { orderId, userId },
      relations: { user: true },
    });

    if (!participant) {
      participant = this.participantRepo.create({ orderId, userId });
      participant = await this.participantRepo.save(participant);
      this.gateway.broadcastToOrder(orderId, 'participant_joined', { orderId, userId });
    }

    return participant;
  }

  async leaveOrder(orderId: number, userId: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException(`Cannot leave order in ${order.status} status`);
    }

    if (order.deadline && new Date() > new Date(order.deadline)) {
      throw new BadRequestException('Order deadline has passed. Cannot leave order.');
    }

    if (order.creatorId === userId) {
      throw new BadRequestException('Order creator cannot leave the order. Cancel or transfer order instead.');
    }

    const participant = await this.participantRepo.findOne({
      where: { orderId, userId },
    });

    if (participant) {
      await this.participantRepo.remove(participant);
      this.gateway.broadcastToOrder(orderId, 'participant_left', { orderId, userId });
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Pickup Hero Selection (Randomly picked, Creator is excepted)
  // ---------------------------------------------------------------------------

  async pickRandomHero(
    orderId: number,
    requestingUserId: number,
  ): Promise<{ hero: any; order: Order; message: string }> {
    const order = await this.getOrderForManagement(orderId, requestingUserId);

    const fullOrder = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: {
        participants: { user: true },
        creator: true,
      },
    });

    if (!fullOrder) throw new NotFoundException(`Order #${orderId} not found`);

    // Except the order creator
    const eligibleParticipants = (fullOrder.participants || []).filter(
      (p) => p.userId !== fullOrder.creatorId && p.user,
    );

    if (eligibleParticipants.length === 0) {
      throw new BadRequestException(
        'Cannot pick a Pickup Hero: no colleagues other than the order creator have joined yet.',
      );
    }

    // Random selection
    const randomIndex = Math.floor(Math.random() * eligibleParticipants.length);
    const selected = eligibleParticipants[randomIndex];

    order.pickupHeroId = selected.userId;
    const saved = await this.orderRepo.save(order);

    const heroUser = selected.user;
    const heroInfo = {
      id: heroUser.id,
      name: heroUser.name,
      email: heroUser.email,
      avatar: heroUser.avatar,
      instapayHandle: heroUser.instapayHandle,
      phoneNumber: heroUser.phoneNumber,
    };

    const message = `🎉 ${heroUser.name} has been randomly chosen as the Pickup Hero to fetch today's breakfast!`;

    // Live broadcast to all participants
    this.gateway.broadcastToOrder(orderId, 'pickup_hero_selected', {
      orderId,
      hero: heroInfo,
      message,
    });
    this.gateway.broadcastGlobal('pickup_hero_selected', {
      orderId,
      hero: heroInfo,
      message,
    });

    // Notify the chosen hero directly
    await this.gateway.sendNotificationToUser({
      sender: fullOrder.title,
      reciever: heroUser.email || String(heroUser.id),
    });

    return { hero: heroInfo, order: saved, message };
  }

  private async tryAutoAssignPickupHero(order: Order): Promise<void> {
    const participants = await this.participantRepo.find({
      where: { orderId: order.id },
      relations: { user: true },
    });

    const eligible = participants.filter((p) => p.userId !== order.creatorId && p.user);
    if (eligible.length > 0) {
      const selected = eligible[Math.floor(Math.random() * eligible.length)];
      order.pickupHeroId = selected.userId;
      await this.orderRepo.save(order);

      const heroUser = selected.user;
      this.gateway.broadcastToOrder(order.id, 'pickup_hero_selected', {
        orderId: order.id,
        hero: {
          id: heroUser.id,
          name: heroUser.name,
          email: heroUser.email,
          instapayHandle: heroUser.instapayHandle,
        },
        message: `🎉 ${heroUser.name} was randomly selected as the Pickup Hero for this order!`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Live "Order Arrived" Notification
  // ---------------------------------------------------------------------------

  async notifyOrderArrived(
    orderId: number,
    requestingUserId: number,
  ): Promise<{ success: boolean; message: string; order: Order }> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: {
        participants: { user: true },
        creator: true,
        pickupHero: true,
        admins: true,
      },
    });

    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    const isCreator = order.creatorId === requestingUserId;
    const isHero = order.pickupHeroId === requestingUserId;
    const isAdmin = (order.admins || []).some((a) => a.userId === requestingUserId);

    if (!isCreator && !isHero && !isAdmin) {
      throw new ForbiddenException(
        'Only the Pickup Hero, Order Creator, or Co-Admin can notify that the order has arrived.',
      );
    }

    order.status = OrderStatus.DELIVERED;
    const saved = await this.orderRepo.save(order);

    const message = 'Order Arrived! 🥐 Food is downstairs/in the pantry, come grab your breakfast!';

    // Live WebSocket broadcast to all connected clients & order participants
    this.gateway.broadcastToOrder(orderId, 'order_arrived', {
      orderId,
      title: order.title,
      restaurantName: order.restaurantName,
      message,
      arrivedAt: new Date(),
    });
    this.gateway.broadcastGlobal('order_arrived', {
      orderId,
      title: order.title,
      restaurantName: order.restaurantName,
      message,
      arrivedAt: new Date(),
    });

    // Create persistent notifications for all participants in the order
    for (const p of order.participants || []) {
      if (p.user) {
        await this.gateway.sendNotificationToUser({
          sender: order.restaurantName || order.title,
          reciever: p.user.email || String(p.user.id),
        });
      }
    }

    return {
      success: true,
      message: 'Order Arrived live notification sent to all participants',
      order: saved,
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Order Items Management (Insert & Delete until deadline)
  // ---------------------------------------------------------------------------

  async addItem(orderId: number, userId: number, dto: AddItemDto): Promise<OrderItem> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException(`Cannot add items to order in ${order.status} status`);
    }

    if (order.deadline && new Date() > new Date(order.deadline)) {
      throw new BadRequestException('Order deadline has passed. You cannot add items.');
    }

    let participant = await this.participantRepo.findOne({
      where: { orderId, userId },
    });

    if (!participant) {
      participant = await this.joinOrder(orderId, userId, {});
    }

    const item = this.itemRepo.create({
      orderId,
      participantId: participant.id,
      name: dto.name,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      notes: dto.notes,
    });

    const saved = await this.itemRepo.save(item);
    this.gateway.broadcastToOrder(orderId, 'item_added', {
      orderId,
      item: {
        id: saved.id,
        name: saved.name,
        quantity: saved.quantity,
        unitPrice: saved.unitPrice,
        notes: saved.notes,
        participantId: saved.participantId,
        orderId: saved.orderId,
        userId,
      },
    });

    return saved;
  }

  async updateItem(
    orderId: number,
    itemId: number,
    userId: number,
    dto: UpdateItemDto,
  ): Promise<OrderItem> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException(`Cannot modify items in ${order.status} status`);
    }

    if (order.deadline && new Date() > new Date(order.deadline)) {
      throw new BadRequestException('Order deadline has passed. You cannot update items.');
    }

    const item = await this.itemRepo.findOne({
      where: { id: itemId, orderId },
      relations: { participant: true },
    });

    if (!item) throw new NotFoundException(`Item #${itemId} not found in order #${orderId}`);

    const isOwner = item.participant.userId === userId;
    const canManage = await this.isUserOrderAdminOrCreator(orderId, userId, order);

    if (!isOwner && !canManage) {
      throw new ForbiddenException('You do not have permission to modify this item');
    }

    if (dto.name !== undefined) item.name = dto.name;
    if (dto.quantity !== undefined) item.quantity = dto.quantity;
    if (dto.unitPrice !== undefined) item.unitPrice = dto.unitPrice;
    if (dto.notes !== undefined) item.notes = dto.notes;

    const saved = await this.itemRepo.save(item);
    this.gateway.broadcastToOrder(orderId, 'item_updated', { orderId, item: saved });
    return saved;
  }

  async removeItem(orderId: number, itemId: number, userId: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException(`Cannot remove items in ${order.status} status`);
    }

    if (order.deadline && new Date() > new Date(order.deadline)) {
      throw new BadRequestException('Order deadline has passed. You cannot delete items.');
    }

    const item = await this.itemRepo.findOne({
      where: { id: itemId, orderId },
      relations: { participant: true },
    });

    if (!item) throw new NotFoundException(`Item #${itemId} not found in order #${orderId}`);

    const isOwner = item.participant.userId === userId;
    const canManage = await this.isUserOrderAdminOrCreator(orderId, userId, order);

    if (!isOwner && !canManage) {
      throw new ForbiddenException('You do not have permission to delete this item');
    }

    await this.itemRepo.remove(item);
    this.gateway.broadcastToOrder(orderId, 'item_removed', { orderId, itemId });
  }

  async getUserItems(
    orderId: number,
    userId: number,
  ): Promise<{ participant: OrderParticipant | null; items: any[]; total: number }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    const participant = await this.participantRepo.findOne({
      where: { orderId, userId },
      relations: { user: true },
    });

    if (!participant) {
      return { participant: null, items: [], total: 0 };
    }

    const items = await this.itemRepo.find({
      where: { orderId, participantId: participant.id },
      order: { createdAt: 'ASC' },
    });

    const formattedItems = items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: Math.round(i.unitPrice * i.quantity * 100) / 100,
      notes: i.notes,
      createdAt: i.createdAt,
    }));

    const total = formattedItems.reduce((acc, i) => acc + i.totalPrice, 0);

    return {
      participant,
      items: formattedItems,
      total: Math.round(total * 100) / 100,
    };
  }

  // ---------------------------------------------------------------------------
  // 7. Multi-Payer Upfront Settlement (Front-Payers)
  // ---------------------------------------------------------------------------

  async addFrontPayer(
    orderId: number,
    requestingUserId: number,
    dto: AddFrontPayerDto,
  ): Promise<OrderFrontPayer> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    const canManage = await this.isUserOrderAdminOrCreator(orderId, requestingUserId, order);
    const isSelf = dto.userId === requestingUserId;

    if (!canManage && !isSelf) {
      throw new ForbiddenException(
        'Only order managers or the front-payer themselves can record an upfront payment.',
      );
    }

    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException(`User #${dto.userId} not found`);

    const frontPayer = this.frontPayerRepo.create({
      orderId,
      userId: dto.userId,
      amountPaid: dto.amountPaid,
      notes: dto.notes,
    });

    const saved = await this.frontPayerRepo.save(frontPayer);

    this.gateway.broadcastToOrder(orderId, 'front_payer_added', {
      orderId,
      payer: {
        id: saved.id,
        userId: user.id,
        userName: user.name,
        instapayHandle: user.instapayHandle,
        phoneNumber: user.phoneNumber,
        amountPaid: saved.amountPaid,
        notes: saved.notes,
      },
    });

    return saved;
  }

  async getFrontPayers(orderId: number): Promise<any[]> {
    const frontPayers = await this.frontPayerRepo.find({
      where: { orderId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    return frontPayers.map((fp) => ({
      id: fp.id,
      userId: fp.userId,
      userName: fp.user?.name,
      userEmail: fp.user?.email,
      instapayHandle: fp.user?.instapayHandle,
      phoneNumber: fp.user?.phoneNumber,
      amountPaid: fp.amountPaid,
      notes: fp.notes,
      createdAt: fp.createdAt,
    }));
  }

  // ---------------------------------------------------------------------------
  // 8. Bill Breakdown (Only accessible when order is SETTLING)
  // ---------------------------------------------------------------------------

  async getBillBreakdown(orderId: number): Promise<any> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    if (order.status !== OrderStatus.SETTLING && order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException(
        `Bill breakdown is only available when the order status is SETTLING. Current status is ${order.status}.`,
      );
    }

    return this.calculateBillBreakdown(orderId);
  }

  private async calculateBillBreakdown(orderId: number): Promise<any> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: {
        creator: true,
        pickupHero: true,
        participants: { user: true },
        items: true,
        frontPayers: { user: true },
      },
    });

    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    const participants = order.participants || [];
    const items = order.items || [];

    // Map each participant to their ordered items and exact items cost
    const participantBills = participants.map((p) => {
      const pItems = items
        .filter((i) => i.participantId === p.id)
        .map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: Math.round(i.unitPrice * i.quantity * 100) / 100,
          notes: i.notes,
        }));

      const itemsTotal = pItems.reduce((acc, i) => acc + i.totalPrice, 0);

      return {
        participantId: p.id,
        userId: p.userId,
        userName: p.user?.name || `User #${p.userId}`,
        userEmail: p.user?.email,
        userAvatar: p.user?.avatar,
        instapayHandle: p.user?.instapayHandle,
        phoneNumber: p.user?.phoneNumber,
        items: pItems,
        itemsCount: pItems.length,
        itemsTotal: Math.round(itemsTotal * 100) / 100,
        addedFee: 0,
        totalAmount: Math.round(itemsTotal * 100) / 100,
      };
    });

    const activeParticipants = participantBills.filter((p) => p.itemsTotal > 0);
    const overallItemsTotal = participantBills.reduce((acc, p) => acc + p.itemsTotal, 0);
    const deliveryFee = order.deliveryFee || 0;

    // If creator added a fee (e.g. delivery fee), allocate fee equally among participants who ordered
    if (activeParticipants.length > 0 && deliveryFee > 0) {
      const feePerPerson = Math.round((deliveryFee / activeParticipants.length) * 100) / 100;
      activeParticipants.forEach((p) => {
        p.addedFee = feePerPerson;
        p.totalAmount = Math.round((p.itemsTotal + feePerPerson) * 100) / 100;
      });
    }

    const grandTotal = Math.round((overallItemsTotal + deliveryFee) * 100) / 100;

    // Fetch existing reimbursements status
    const reimbursements = await this.reimbursementRepo.find({
      where: { orderId },
      relations: { confirmedBy: true, paidToUser: true },
    });

    const reimbursementMap = new Map(reimbursements.map((r) => [r.participantId, r]));

    const enrichedBills = participantBills.map((p) => {
      const reimbursement = reimbursementMap.get(p.participantId);
      return {
        ...p,
        reimbursement: reimbursement
          ? {
              id: reimbursement.id,
              status: reimbursement.status,
              paymentMethod: reimbursement.paymentMethod,
              amountDue: reimbursement.amountDue,
              amountGiven: reimbursement.amountGiven,
              changeDue: reimbursement.changeDue,
              isChangeReturned: reimbursement.isChangeReturned,
              transactionReference: reimbursement.transactionReference,
              paidAt: reimbursement.paidAt,
              paidToUser: reimbursement.paidToUser
                ? {
                    id: reimbursement.paidToUser.id,
                    name: reimbursement.paidToUser.name,
                    instapayHandle: reimbursement.paidToUser.instapayHandle,
                    phoneNumber: reimbursement.paidToUser.phoneNumber,
                  }
                : null,
              confirmedAt: reimbursement.confirmedAt,
              confirmedBy: reimbursement.confirmedBy
                ? { id: reimbursement.confirmedBy.id, name: reimbursement.confirmedBy.name }
                : null,
            }
          : {
              status: ReimbursementStatus.PENDING,
              paymentMethod: PaymentMethod.CASH,
              amountDue: p.totalAmount,
              amountGiven: null,
              changeDue: 0,
              isChangeReturned: false,
              paidAt: null,
              confirmedAt: null,
            },
      };
    });

    // Front-Payers Summary (Who fronted money and how much they've collected)
    const frontPayersList = await this.getFrontPayers(orderId);
    const totalFronted = frontPayersList.reduce((acc, fp) => acc + fp.amountPaid, 0);

    return {
      orderId: order.id,
      title: order.title,
      status: order.status,
      restaurantName: order.restaurantName,
      creatorId: order.creatorId,
      creatorName: order.creator?.name,
      creatorInstapay: order.creator?.instapayHandle,
      creatorPhone: order.creator?.phoneNumber,
      pickupHero: order.pickupHero
        ? {
            id: order.pickupHero.id,
            name: order.pickupHero.name,
            avatar: order.pickupHero.avatar,
            instapayHandle: order.pickupHero.instapayHandle,
            phoneNumber: order.pickupHero.phoneNumber,
          }
        : null,
      addedDeliveryFee: deliveryFee,
      itemsTotal: Math.round(overallItemsTotal * 100) / 100,
      grandTotal,
      frontPayers: frontPayersList,
      totalFronted,
      participants: enrichedBills,
    };
  }

  // ---------------------------------------------------------------------------
  // 9. Payment Settlement, Change Tracker ("Fakka") & Instapay
  // ---------------------------------------------------------------------------

  async payCash(orderId: number, userId: number, dto: PayCashDto): Promise<Reimbursement> {
    const breakdown = await this.getBillBreakdown(orderId);
    const participantData = breakdown.participants.find((p: any) => p.userId === userId);

    if (!participantData) {
      throw new NotFoundException('You are not a participant in this order');
    }

    const amountDue = participantData.totalAmount;
    const amountGiven = dto.amountGiven !== undefined ? dto.amountGiven : amountDue;
    const changeDue = Math.max(0, Math.round((amountGiven - amountDue) * 100) / 100);

    let reimbursement = await this.reimbursementRepo.findOne({
      where: { orderId, participantId: participantData.participantId },
    });

    const paymentMethod = dto.paymentMethod || PaymentMethod.CASH;
    const paidToUserId = dto.paidToUserId || breakdown.creatorId;

    if (!reimbursement) {
      reimbursement = this.reimbursementRepo.create({
        orderId,
        participantId: participantData.participantId,
        amountDue,
        amountGiven,
        changeDue,
        isChangeReturned: changeDue === 0,
        paidToUserId,
        transactionReference: dto.transactionReference,
        paymentMethod,
        status: ReimbursementStatus.PAID_BY_PARTICIPANT,
        paidAt: new Date(),
      });
    } else {
      reimbursement.amountDue = amountDue;
      reimbursement.amountGiven = amountGiven;
      reimbursement.changeDue = changeDue;
      reimbursement.isChangeReturned = changeDue === 0;
      reimbursement.paidToUserId = paidToUserId;
      reimbursement.transactionReference = dto.transactionReference;
      reimbursement.paymentMethod = paymentMethod;
      reimbursement.status = ReimbursementStatus.PAID_BY_PARTICIPANT;
      reimbursement.paidAt = new Date();
    }

    const saved = await this.reimbursementRepo.save(reimbursement);

    this.gateway.broadcastToOrder(orderId, 'payment_submitted', {
      orderId,
      participantId: participantData.participantId,
      userId,
      amountDue,
      amountGiven,
      changeDue,
      paymentMethod,
      transactionReference: dto.transactionReference,
      paidToUserId,
      reimbursement: saved,
    });

    return saved;
  }

  async returnChange(
    orderId: number,
    participantId: number,
    userId: number,
  ): Promise<Reimbursement> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    let reimbursement = await this.reimbursementRepo.findOne({
      where: { orderId, participantId },
    });

    if (!reimbursement) {
      throw new NotFoundException(`No reimbursement record found for participant #${participantId}`);
    }

    const isCollector = reimbursement.paidToUserId === userId;
    const isCreator = order.creatorId === userId;
    const isAdmin = await this.adminRepo.findOne({ where: { orderId, userId } });

    if (!isCollector && !isCreator && !isAdmin) {
      throw new ForbiddenException(
        'Only the person who collected the money or the order creator can mark change as returned.',
      );
    }

    reimbursement.isChangeReturned = true;
    reimbursement.changeReturnedAt = new Date();
    const saved = await this.reimbursementRepo.save(reimbursement);

    this.gateway.broadcastToOrder(orderId, 'change_returned', {
      orderId,
      participantId,
      changeDue: saved.changeDue,
      reimbursement: saved,
    });

    return saved;
  }

  async confirmPayment(
    orderId: number,
    participantId: number,
    confirmerId: number,
  ): Promise<Reimbursement> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    let reimbursement = await this.reimbursementRepo.findOne({
      where: { orderId, participantId },
    });

    const isPaidToConfirmer = reimbursement?.paidToUserId === confirmerId;
    const isPickupHero = order.pickupHeroId === confirmerId;
    const isCreator = order.creatorId === confirmerId;
    const isAdmin = await this.adminRepo.findOne({ where: { orderId, userId: confirmerId } });

    if (!isPaidToConfirmer && !isPickupHero && !isCreator && !isAdmin) {
      throw new ForbiddenException(
        'Only the recipient of the payment, pickup hero, or order creator can confirm payment',
      );
    }

    if (!reimbursement) {
      const breakdown = await this.getBillBreakdown(orderId);
      const participantData = breakdown.participants.find(
        (p: any) => p.participantId === participantId,
      );

      reimbursement = this.reimbursementRepo.create({
        orderId,
        participantId,
        amountDue: participantData ? participantData.totalAmount : 0,
        paymentMethod: PaymentMethod.CASH,
        changeDue: 0,
        isChangeReturned: true,
      });
    }

    reimbursement.status = ReimbursementStatus.CONFIRMED;
    reimbursement.confirmedById = confirmerId;
    reimbursement.confirmedAt = new Date();

    const saved = await this.reimbursementRepo.save(reimbursement);

    this.gateway.broadcastToOrder(orderId, 'payment_confirmed', {
      orderId,
      participantId,
      reimbursement: saved,
    });

    return saved;
  }

  // ---------------------------------------------------------------------------
  // 10. Automatic Deadline Enforcement (Cron Scheduler)
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleDeadlineChecks() {
    const now = new Date();
    const expiredOrders = await this.orderRepo.find({
      where: {
        status: OrderStatus.OPEN,
        deadline: LessThanOrEqual(now),
      },
    });

    for (const order of expiredOrders) {
      order.status = OrderStatus.LOCKED;

      if (!order.pickupHeroId) {
        await this.tryAutoAssignPickupHero(order);
      }

      await this.orderRepo.save(order);

      this.gateway.broadcastToOrder(order.id, 'order_locked', {
        orderId: order.id,
        reason: 'DEADLINE_REACHED',
        lockedAt: now,
      });

      this.gateway.broadcastToOrder(order.id, 'status_changed', {
        orderId: order.id,
        status: OrderStatus.LOCKED,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Helper Authorization Methods
  // ---------------------------------------------------------------------------

  private async getOrderForManagement(orderId: number, userId: number): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    const hasPermission = await this.isUserOrderAdminOrCreator(orderId, userId, order);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to manage this order');
    }

    return order;
  }

  private async isUserOrderAdminOrCreator(
    orderId: number,
    userId: number,
    orderInstance?: Order,
  ): Promise<boolean> {
    const order = orderInstance || (await this.orderRepo.findOne({ where: { id: orderId } }));
    if (!order) return false;
    if (order.creatorId === userId) return true;

    const admin = await this.adminRepo.findOne({ where: { orderId, userId } });
    return !!admin;
  }
}
