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
import type { User } from '../../users/user.entity';

export enum PaymentMethod {
  CASH = 'CASH',
  INSTAPAY = 'INSTAPAY',
  VODAFONE_CASH = 'VODAFONE_CASH',
  ONLINE = 'ONLINE',
}

export enum ReimbursementStatus {
  PENDING = 'PENDING',
  PAID_BY_PARTICIPANT = 'PAID_BY_PARTICIPANT',
  CONFIRMED = 'CONFIRMED',
}

@Entity('reimbursements')
export class Reimbursement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @ManyToOne('Order', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Relation<Order>;

  @Column()
  participantId: number;

  @ManyToOne('OrderParticipant', 'reimbursements', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participantId' })
  participant: Relation<OrderParticipant>;

  @Column({ type: 'float' })
  amountDue: number;

  @Column({ type: 'float', nullable: true })
  amountGiven?: number;

  @Column({ type: 'float', default: 0 })
  changeDue: number;

  @Column({ default: false })
  isChangeReturned: boolean;

  @Column({ type: 'datetime', nullable: true })
  changeReturnedAt?: Date;

  @Column({
    type: 'text',
    default: PaymentMethod.CASH,
  })
  paymentMethod: PaymentMethod;

  @Column({ nullable: true })
  paidToUserId?: number;

  @ManyToOne('User', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'paidToUserId' })
  paidToUser?: Relation<User>;

  @Column({ nullable: true })
  transactionReference?: string;

  @Column({
    type: 'text',
    default: ReimbursementStatus.PENDING,
  })
  status: ReimbursementStatus;

  @Column({ type: 'datetime', nullable: true })
  paidAt?: Date;

  @Column({ nullable: true })
  confirmedById?: number;

  @ManyToOne('User', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmedById' })
  confirmedBy?: Relation<User>;

  @Column({ type: 'datetime', nullable: true })
  confirmedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
