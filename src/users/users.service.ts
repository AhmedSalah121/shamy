import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { QueryFailedError, Repository } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(name: string, email: string): Promise<User> {
    const user = this.userRepository.create({ name, email });

    try {
      return await this.userRepository.save(user);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code?.startsWith(
          'SQLITE_CONSTRAINT',
        )
      ) {
        throw new ConflictException('Email already used');
      }

      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find();
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async updateUser(id: number, name: string): Promise<void> {
    await this.userRepository.update(id, { name });
  }

  async deleteUser(id: number): Promise<void> {
    await this.userRepository.delete(id);
  }

  async findCustom(emailDomain: string): Promise<User[]> {
    return await this.userRepository
      .createQueryBuilder('user')
      .where('user.email LIKE :domain', { domain: `%${emailDomain}` })
      .orderBy('user.id', 'DESC')
      .getMany();
  }
}
