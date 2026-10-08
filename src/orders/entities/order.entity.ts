import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  type Relation,
} from 'typeorm';
import type { User } from '../../users/user.entity';
import type { OrderAdmin } from './order-admin.entity';
import type { OrderParticipant } from './order-participant.entity';
import type { OrderItem } from './order-item.entity';

export enum OrderStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  LOCKED = 'LOCKED',
  ORDERED = 'ORDERED',
  DELIVERED = 'DELIVERED',
  SETTLING = 'SETTLING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum OrderVisibility {
  PUBLIC = 'PUBLIC',
  VIP = 'VIP',
}

export enum FeeSplitType {
  EQUAL = 'EQUAL',
  PROPORTIONAL = 'PROPORTIONAL',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column({
    type: 'text',
    default: OrderStatus.OPEN,
  })
  status: OrderStatus;

  @Column({
    type: 'text',
    default: OrderVisibility.PUBLIC,
  })
  visibility: OrderVisibility;

  @Column({ nullable: true })
  vipPassword?: string;

  @Column({ nullable: true, unique: true })
  vipInviteCode?: string;

  @Column({ type: 'datetime', nullable: true })
  deadline?: Date;

  @Column({
    type: 'text',
    default: FeeSplitType.EQUAL,
  })
  feeSplitType: FeeSplitType;

  @Column({ type: 'float', default: 0 })
  deliveryFee: number;

  @Column({ type: 'float', default: 0 })
  serviceFee: number;

  @Column({ type: 'float', default: 0 })
  discount: number;

  @Column({ nullable: true })
  restaurantName?: string;

  @Column({ nullable: true })
  restaurantPhone?: string;

  @Column({ nullable: true })
  menuUrl?: string;

  @Column({ nullable: true })
  menuImageUrl?: string;

  @Column({ default: false })
  hideParticipantItems: boolean;

  @Column()
  creatorId: number;

  @ManyToOne('User', 'createdOrders', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creatorId' })
  creator: Relation<User>;

  @Column({ nullable: true })
  pickupHeroId?: number;

  @ManyToOne('User', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pickupHeroId' })
  pickupHero?: Relation<User>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany('OrderAdmin', 'order', { cascade: true })
  admins: Relation<OrderAdmin[]>;

  @OneToMany('OrderParticipant', 'order', { cascade: true })
  participants: Relation<OrderParticipant[]>;

  @OneToMany('OrderItem', 'order', { cascade: true })
  items: Relation<OrderItem[]>;

  @OneToMany('OrderFrontPayer', 'order', { cascade: true })
  frontPayers: Relation<any[]>;
}
