import { IsEnum, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

export class UpdateStatusDto {
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fee?: number;
}
