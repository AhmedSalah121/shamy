import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddFrontPayerDto {
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amountPaid: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
