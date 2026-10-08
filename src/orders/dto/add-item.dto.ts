import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class AddItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
