import { IsInt, IsNotEmpty } from 'class-validator';

export class AssignAdminDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;
}
