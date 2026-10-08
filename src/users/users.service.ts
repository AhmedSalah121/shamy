import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

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

    const user = this.userRepository.create({
      name,
      email,
      password: hashedPassword,
      avatar,
      instapayHandle,
      phoneNumber,
    });

    try {
      return await this.userRepository.save(user);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code?.startsWith(
          'SQLITE_CONSTRAINT',
        )
      ) {
        throw new ConflictException('Email already in use');
      }

      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async findAll(): Promise<Omit<User, 'password'>[]> {
    const users = await this.userRepository.find();
    return users.map((u) => {
      const { password: _password, ...safeUser } = u;
      return safeUser as Omit<User, 'password'>;
    });
  }

  async findById(id: number): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
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
    if (updateData.name !== undefined) user.name = updateData.name;
    if (updateData.avatar !== undefined) user.avatar = updateData.avatar;
    if (updateData.instapayHandle !== undefined) user.instapayHandle = updateData.instapayHandle;
    if (updateData.phoneNumber !== undefined) user.phoneNumber = updateData.phoneNumber;
    if (updateData.hashedRefreshToken !== undefined) user.refreshToken = updateData.hashedRefreshToken;
    return await this.userRepository.save(user);
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.userRepository.delete(id);
  }

  async findCustom(emailDomain: string): Promise<Omit<User, 'password'>[]> {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .where('user.email LIKE :domain', { domain: `%${emailDomain}` })
      .orderBy('user.id', 'DESC')
      .getMany();

    return users.map((u) => {
      const { password: _password, ...safeUser } = u;
      return safeUser as Omit<User, 'password'>;
    });
  }

  async searchUsers(query: string): Promise<Omit<User, 'password'>[]> {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .where('user.name LIKE :query OR user.email LIKE :query', {
        query: `%${query}%`,
      })
      .orderBy('user.name', 'ASC')
      .take(20)
      .getMany();

    return users.map((u) => {
      const { password: _password, ...safeUser } = u;
      return safeUser as Omit<User, 'password'>;
    });
  }
}
