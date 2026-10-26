import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User } from '@prisma/client';
import { JwtRefreshGuard } from '../common/guards/jwt-refresh-guard.js';

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
