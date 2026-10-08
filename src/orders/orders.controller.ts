import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';

import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JoinOrderDto } from './dto/join-order.dto';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { AssignAdminDto } from './dto/assign-admin.dto';
import { PayCashDto } from './dto/reimbursement.dto';
import { AddFrontPayerDto } from './dto/front-payer.dto';
import { OrderStatus } from './entities/order.entity';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // POST /orders - Create a new breakfast order session
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user.id, dto);
  }

  // GET /orders - List all public orders or user orders
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async findAll(@CurrentUser() user?: User) {
    return this.ordersService.getOrders(user?.id);
  }

  // GET /orders/:id - Get full order details, tracking info, and Pickup Hero
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user?: User,
  ) {
    return this.ordersService.getOrderDetails(id, user?.id);
  }

  // GET /orders/:id/my-items - Track the items currently included by the authenticated user
  @UseGuards(JwtAuthGuard)
  @Get(':id/my-items')
  async getMyItems(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.getUserItems(id, user.id);
  }

  // PATCH /orders/:id - Update order metadata (creator or co-admin)
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.updateOrder(id, user.id, dto);
  }

  // PATCH /orders/:id/status - Update order status (creator or co-admin)
  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.ordersService.updateStatus(id, user.id, dto.status, dto.fee);
  }

  // POST /orders/:id/settle - Creator transitions status to SETTLING and adds extra/delivery fee
  @UseGuards(JwtAuthGuard)
  @Post(':id/settle')
  async settle(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body('fee') fee?: number,
  ) {
    return this.ordersService.updateStatus(id, user.id, OrderStatus.SETTLING, fee);
  }

  // POST /orders/:id/lock - Lock the order before placing with restaurant
  @UseGuards(JwtAuthGuard)
  @Post(':id/lock')
  async lock(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.lockOrder(id, user.id);
  }

  // POST /orders/:id/join - Join order as participant
  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  async join(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: JoinOrderDto,
  ) {
    return this.ordersService.joinOrder(id, user.id, dto);
  }

  // POST /orders/:id/leave - Leave order as participant
  @UseGuards(JwtAuthGuard)
  @Post(':id/leave')
  async leave(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.leaveOrder(id, user.id);
  }

  // POST /orders/:id/admins - Assign co-admin
  @UseGuards(JwtAuthGuard)
  @Post(':id/admins')
  async assignAdmin(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: AssignAdminDto,
  ) {
    return this.ordersService.assignAdmin(id, user.id, dto.userId);
  }

  // DELETE /orders/:id/admins/:userId - Remove co-admin
  @UseGuards(JwtAuthGuard)
  @Delete(':id/admins/:userId')
  async removeAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) targetUserId: number,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.removeAdmin(id, user.id, targetUserId);
  }

  // ---------------------------------------------------------------------------
  // Pickup Hero & Arrival Notifications
  // ---------------------------------------------------------------------------

  // POST /orders/:id/pick-hero - Randomly pick a Pickup Hero (Order Creator is excepted!)
  @UseGuards(JwtAuthGuard)
  @Post(':id/pick-hero')
  async pickHero(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.pickRandomHero(id, user.id);
  }

  // POST /orders/:id/arrived - Broadcast live "Order Arrived" notification to all participants
  @UseGuards(JwtAuthGuard)
  @Post(':id/arrived')
  async notifyArrived(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.notifyOrderArrived(id, user.id);
  }

  // ---------------------------------------------------------------------------
  // Multi-Payer Support (Upfront Payers)
  // ---------------------------------------------------------------------------

  // POST /orders/:id/front-payers - Record upfront payment made to delivery driver
  @UseGuards(JwtAuthGuard)
  @Post(':id/front-payers')
  async addFrontPayer(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: AddFrontPayerDto,
  ) {
    return this.ordersService.addFrontPayer(id, user.id, dto);
  }

  // GET /orders/:id/front-payers - List all upfront payers for this order
  @Get(':id/front-payers')
  async getFrontPayers(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.getFrontPayers(id);
  }

  // ---------------------------------------------------------------------------
  // Item Operations (allowed only before deadline)
  // ---------------------------------------------------------------------------

  // POST /orders/:id/items - Add an item to the order
  @UseGuards(JwtAuthGuard)
  @Post(':id/items')
  async addItem(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: AddItemDto,
  ) {
    return this.ordersService.addItem(id, user.id, dto);
  }

  // PATCH /orders/:id/items/:itemId - Update an item
  @UseGuards(JwtAuthGuard)
  @Patch(':id/items/:itemId')
  async updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: User,
    @Body() dto: UpdateItemDto,
  ) {
    return this.ordersService.updateItem(id, itemId, user.id, dto);
  }

  // DELETE /orders/:id/items/:itemId - Delete an item
  @UseGuards(JwtAuthGuard)
  @Delete(':id/items/:itemId')
  async removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.removeItem(id, itemId, user.id);
  }

  // ---------------------------------------------------------------------------
  // Bill Breakdown & Payments
  // ---------------------------------------------------------------------------

  // GET /orders/:id/bills - Returns the bill breakdown (allowed only when SETTLING or COMPLETED)
  @Get(':id/bills')
  async getBillBreakdown(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.getBillBreakdown(id);
  }

  // POST /orders/:id/pay-cash - Participant submits payment (with change tracker & Instapay reference)
  @UseGuards(JwtAuthGuard)
  @Post(':id/pay-cash')
  async payCash(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: PayCashDto,
  ) {
    return this.ordersService.payCash(id, user.id, dto);
  }

  // POST /orders/:id/reimbursements/:participantId/return-change - Mark change as returned to participant
  @UseGuards(JwtAuthGuard)
  @Post(':id/reimbursements/:participantId/return-change')
  async returnChange(
    @Param('id', ParseIntPipe) id: number,
    @Param('participantId', ParseIntPipe) participantId: number,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.returnChange(id, participantId, user.id);
  }

  // POST /orders/:id/reimbursements/:participantId/confirm - Confirm receipt of payment
  @UseGuards(JwtAuthGuard)
  @Post(':id/reimbursements/:participantId/confirm')
  async confirmPayment(
    @Param('id', ParseIntPipe) id: number,
    @Param('participantId', ParseIntPipe) participantId: number,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.confirmPayment(id, participantId, user.id);
  }
}
