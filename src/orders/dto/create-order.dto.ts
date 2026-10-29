import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { OrderVisibility } from '@prisma/client';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(OrderVisibility)
  @IsOptional()
  visibility?: OrderVisibility;

  @IsString()
  @IsOptional()
  vipPassword?: string;

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  deliveryFee?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  serviceFee?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsString()
  @IsOptional()
  restaurantName?: string;

  @IsString()
  @IsOptional()
  restaurantPhone?: string;

  @IsString()
  @IsOptional()
  menuUrl?: string;

  @IsString()
  @IsOptional()
  menuImageUrl?: string;

  @IsBoolean()
  @IsOptional()
  hideParticipantItems?: boolean;

  @IsNumber()
  @IsOptional()
  pickupPersonId?: number;

  @IsNumber()
  @IsOptional()
  pickupHeroId?: number;
}
