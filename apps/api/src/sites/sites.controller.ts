import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/jwt.types';
import { SitesService } from './sites.service';
import { SiteInputDto } from './sites.dto';

@Controller('admin/sites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  /** Supervisors need the list for filter dropdowns / map context. */
  @Get()
  @Roles('admin', 'supervisor')
  list() {
    return this.sites.list();
  }

  @Post()
  @Roles('admin')
  create(@CurrentUser() user: RequestUser, @Body() dto: SiteInputDto) {
    return this.sites.create(user.id, dto);
  }

  @Put(':id')
  @Roles('admin')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: SiteInputDto) {
    return this.sites.update(user.id, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  deactivate(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.sites.deactivate(user.id, id);
  }
}
