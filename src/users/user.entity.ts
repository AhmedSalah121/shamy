import {
  Column,
  PrimaryGeneratedColumn,
  Entity,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  type Relation,
} from 'typeorm';
import type { Order } from '../orders/entities/order.entity';
import type { OrderAdmin } from '../orders/entities/order-admin.entity';
import type { OrderParticipant } from '../orders/entities/order-participant.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ nullable: true })
  instapayHandle?: string;

  @Column({ nullable: true })
  phoneNumber?: string;
  
  @Column({ nullable: true, select: false })
  refreshToken?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany('Order', 'creator')
  createdOrders: Relation<Order[]>;

  @OneToMany('OrderAdmin', 'user')
  adminRoles: Relation<OrderAdmin[]>;

  @OneToMany('OrderParticipant', 'user')
  participations: Relation<OrderParticipant[]>;
}
