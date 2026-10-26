import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || ''});
  }

  async validate(payload: { sub: number; email: string }) {
    // Only active (non-soft-deleted) users will be returned by findById
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found or token invalid');
    }

    // Strip sensitive fields (password and hashed refresh token) from req.user
    const { password: _password, refreshToken: _refreshToken, ...result } = user;
    return result;
  }
}
