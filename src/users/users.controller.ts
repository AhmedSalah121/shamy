import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from "./users.service";
import { User } from './user.entity';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    // POST /users
    @Post()
    async create(
        @Body('name') name: string,
        @Body('email') email: string,
    ): Promise<User> {
        if (!name?.trim() || !email?.trim()) {
            throw new BadRequestException('name and email are required');
        }

        return await this.usersService.create(name.trim(), email.trim());
    }

    // GET /users
    @Get('all')
    async fetch(): Promise<User[]> {
        return await this.usersService.findAll();
    }

  // GET /users/search?domain=gmail.com
  @Get('search')
  async searchByDomain(@Query('domain') domain: string): Promise<User[]> {
    return await this.usersService.findCustom(domain);
  }

  // GET /users/email/user@example.com
  @Get('email/:email')
  async findByEmail(@Param('email') email: string): Promise<User | null> {
    return await this.usersService.findByEmail(email);
  }

  // PATCH /users/:id
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body('name') name: string,
  ): Promise<void> {
    return await this.usersService.updateUser(+id, name);
  }

  // DELETE /users/:id
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return await this.usersService.deleteUser(+id);
  }
}
