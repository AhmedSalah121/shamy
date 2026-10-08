import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from './user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users/search?query=alice
  @UseGuards(JwtAuthGuard)
  @Get('search')
  async search(@Query('query') query: string) {
    if (!query) return [];
    return await this.usersService.searchUsers(query);
  }

  // GET /users/all (authenticated)
  @UseGuards(JwtAuthGuard)
  @Get('all')
  async fetch() {
    return await this.usersService.findAll();
  }

  // GET /users/email/:email
  @UseGuards(JwtAuthGuard)
  @Get('email/:email')
  async findByEmail(@Param('email') email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const { password: _password, ...safeUser } = user;
    return safeUser;
  }

  // GET /users/:id
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findById(id);
    if (!user) return null;
    const { password: _password, ...safeUser } = user;
    return safeUser;
  }

  // PATCH /users/me
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateProfile(
    @CurrentUser() currentUser: User,
    @Body('name') name?: string,
    @Body('avatar') avatar?: string,
    @Body('instapayHandle') instapayHandle?: string,
    @Body('phoneNumber') phoneNumber?: string,
  ) {
    const updated = await this.usersService.updateUser(currentUser.id, {
      name,
      avatar,
      instapayHandle,
      phoneNumber,
    });
    const { password: _password, ...safeUser } = updated;
    return safeUser;
  }

  // DELETE /users/:id
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.usersService.deleteUser(id);
  }
}
