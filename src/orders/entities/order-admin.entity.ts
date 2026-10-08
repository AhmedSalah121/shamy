import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  type Relation,
} from 'typeorm';
import type { Order } from './order.entity';
import type { User } from '../../users/user.entity';

@Entity('order_admins')
@Unique(['orderId', 'userId'])
export class OrderAdmin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @ManyToOne('Order', 'admins', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Relation<Order>;

  @Column()
  userId: number;

  @ManyToOne('User', 'adminRoles', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @CreateDateColumn()
  assignedAt: Date;
}
