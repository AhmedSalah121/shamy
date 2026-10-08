import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  type Relation,
} from 'typeorm';
import type { Order } from './order.entity';
import type { User } from '../../users/user.entity';

@Entity('order_front_payers')
export class OrderFrontPayer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @ManyToOne('Order', 'frontPayers', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Relation<Order>;

  @Column()
  userId: number;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({ type: 'float' })
  amountPaid: number;

  @Column({ nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;
}
