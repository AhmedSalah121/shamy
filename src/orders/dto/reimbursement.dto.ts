import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '../entities/reimbursement.entity';

export class PayCashDto {
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod = PaymentMethod.CASH;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amountGiven?: number;

  @IsInt()
  @IsOptional()
  paidToUserId?: number;

  @IsString()
  @IsOptional()
  transactionReference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ConfirmPaymentDto {
  @IsInt()
  @IsNotEmpty()
  participantId: number;
}
