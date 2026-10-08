import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email.trim().toLowerCase());
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const user = await this.usersService.create(
      dto.name.trim(),
      dto.email.trim().toLowerCase(),
      dto.password,
      dto.avatar,
      dto.instapayHandle,
      dto.phoneNumber,
    );

    const token = (await this.generateTokens(user.id, user.email)).accessToken;
    const { password: _password, ...safeUser } = user;

    return {
      user: safeUser,
      accessToken: token,
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = (await this.generateTokens(user.id, user.email)).accessToken;
    const { password: _password1, ...safeUser } = user;

    return {
      user: safeUser,
      accessToken: token,
    };
  }

  private async generateTokens(userId: number, email: string) {
    const payload = { sub: userId, email };

    const accessSecret =
      process.env.JWT_ACCESS_SECRET ||
      process.env.JWT_SECRET ||
      'shamy_jwt_secret_key_2026';
    const refreshSecret =
      process.env.JWT_REFRESH_SECRET ||
      'shamy_jwt_refresh_secret_key_2026';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: '7d',
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: '30d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(userId: number, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access Denied');
    }

    // Verify token matching against stored hash
    const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Access Denied');
    }

    // Generate new pair (Token Rotation)
    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  private async updateRefreshToken(userId: number, refreshToken: string) {
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateUser(userId, { hashedRefreshToken: hashed });
  }
}
