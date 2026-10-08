import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  type Relation,
} from 'typeorm';
import type { Order } from './order.entity';
import type { OrderParticipant } from './order-participant.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @ManyToOne('Order', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Relation<Order>;

  @Column()
  participantId: number;

  @ManyToOne('OrderParticipant', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participantId' })
  participant: Relation<OrderParticipant>;

  @Column()
  name: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'float' })
  unitPrice: number;

  @Column({ nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
