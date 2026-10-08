import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { JwtRefreshGuard } from '../common/guards/jwt-refresh-guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: Omit<User, 'password'>) {
    return user;
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refreshTokens(@CurrentUser() user: { sub: number; refreshToken: string }) {
    return this.authService.refreshTokens(user.sub, user.refreshToken);
  }
}
