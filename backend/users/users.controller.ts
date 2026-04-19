import { Controller, Post, Body, UseGuards, Get, Inject, Put, Param, Request, Delete, ForbiddenException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findAll() {
    const users = await this.usersService.findAll();
    return {
      success: true,
      data: users
    };
  }

  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(@Body() createDto: CreateUserDto) {
    const user = await this.usersService.createUser(createDto);
    return {
      success: true,
      message: 'Пользователь успешно создан',
      data: user
    };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async update(@Param('id') id: string, @Body() body: { name: string }, @Request() req) {
    if (req.user.role !== 'ADMIN' && req.user.id !== id) {
      throw new ForbiddenException('Нет прав для редактирования данного пользователя');
    }
    const user = await this.usersService.updateUser(id, body.name);
    return { success: true, data: user };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @Request() req) {
    if (req.user.id === id) {
      throw new BadRequestException('Нельзя удалить собственную учетную запись');
    }
    await this.usersService.deleteUser(id);
    return { success: true, message: 'Пользователь удален' };
  }
}
