import { Injectable, ConflictException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UserRole } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async createUser(dto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (existingUser) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: dto.role || UserRole.MANAGER,
      }
    });

    // Exclude passwordHash from returned result
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    return users.map(user => {
      const { passwordHash, ...result } = user;
      return result;
    });
  }

  async updateUser(id: string, name: string) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { name }
    });
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async deleteUser(id: string) {
    await this.prisma.user.delete({
      where: { id }
    });
  }
}
