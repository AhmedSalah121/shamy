import { IsOptional, IsString } from 'class-validator';

export class JoinOrderDto {
  @IsString()
  @IsOptional()
  vipPassword?: string;

  @IsString()
  @IsOptional()
  inviteCode?: string;
}
