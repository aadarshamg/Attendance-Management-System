import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/jwt.types';
import { UsersService } from './users.service';
import { UserCreateDto, UserUpdateDto } from './users.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: UserCreateDto) {
    return this.users.create(user.id, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UserUpdateDto) {
    return this.users.update(user.id, id, dto);
  }

  @Delete(':id')
  deactivate(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.users.deactivate(user.id, id);
  }
}
