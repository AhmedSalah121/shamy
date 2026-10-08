import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
  type Relation,
} from 'typeorm';
import type { Order } from './order.entity';
import type { User } from '../../users/user.entity';
import type { OrderItem } from './order-item.entity';
import type { Reimbursement } from './reimbursement.entity';

@Entity('order_participants')
@Unique(['orderId', 'userId'])
export class OrderParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @ManyToOne('Order', 'participants', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Relation<Order>;

  @Column()
  userId: number;

  @ManyToOne('User', 'participations', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @CreateDateColumn()
  joinedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany('OrderItem', 'participant', { cascade: true })
  items: Relation<OrderItem[]>;

  @OneToMany('Reimbursement', 'participant', { cascade: true })
  reimbursements: Relation<Reimbursement[]>;
}
