import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    name: string,
    email: string,
    password?: string,
    avatar?: string,
    instapayHandle?: string,
    phoneNumber?: string,
  ): Promise<User> {
    let hashedPassword: string | undefined = undefined;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    try {
      return await this.prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          avatar,
          instapayHandle,
          phoneNumber,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }

      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async findAll(): Promise<Omit<User, 'password'>[]> {
    const users = await this.prisma.user.findMany({
      where: { deleted_at: null },
    });
    return users.map((u) => {
      const { password: _password, ...safeUser } = u;
      return safeUser as Omit<User, 'password'>;
    });
  }

  async findById(id: number): Promise<User | null> {
    return await this.prisma.user.findFirst({
      where: { id, deleted_at: null },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.prisma.user.findFirst({
      where: { email, deleted_at: null },
    });
  }

  async updateUser(
    id: number,
    updateData: {
      name?: string;
      avatar?: string;
      instapayHandle?: string;
      phoneNumber?: string;
      hashedRefreshToken?: string;
    },
  ): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const data: Prisma.UserUpdateInput = {};
    if (updateData.name !== undefined) data.name = updateData.name;
    if (updateData.avatar !== undefined) data.avatar = updateData.avatar;
    if (updateData.instapayHandle !== undefined) data.instapayHandle = updateData.instapayHandle;
    if (updateData.phoneNumber !== undefined) data.phoneNumber = updateData.phoneNumber;
    if (updateData.hashedRefreshToken !== undefined) data.refreshToken = updateData.hashedRefreshToken;

    return await this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.prisma.user.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async findCustom(emailDomain: string): Promise<Omit<User, 'password'>[]> {
    const users = await this.prisma.user.findMany({
      where: {
        email: {
          endsWith: emailDomain,
          mode: 'insensitive',
        },
        deleted_at: null,
      },
      orderBy: { id: 'desc' },
    });

    return users.map((u) => {
      const { password: _password, ...safeUser } = u;
      return safeUser as Omit<User, 'password'>;
    });
  }

  async searchUsers(query: string): Promise<Omit<User, 'password'>[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deleted_at: null,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      take: 20,
    });

    return users.map((u) => {
      const { password: _password, ...safeUser } = u;
      return safeUser as Omit<User, 'password'>;
    });
  }
}
