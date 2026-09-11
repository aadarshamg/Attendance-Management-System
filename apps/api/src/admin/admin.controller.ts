import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/jwt.types';
import { AuditService } from '../audit/audit.service';
import { AdminService } from './admin.service';
import { AdminRecordQueryDto, AuditQueryDto, RecordReviewDto } from './query.dto';
import { toCsv, toSpreadsheetXml } from './export';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly audit: AuditService,
  ) {}

  @Get('attendance')
  @Roles('admin', 'supervisor')
  list(@CurrentUser() user: RequestUser, @Query() query: AdminRecordQueryDto) {
    return this.admin.listRecords(user, query);
  }

  @Get('attendance/export')
  @Roles('admin', 'supervisor')
  async export(
    @CurrentUser() user: RequestUser,
    @Query() query: AdminRecordQueryDto,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
    @Res() res: Response,
  ) {
    const records = await this.admin.recordsForExport(user, query);
    await this.audit.record({
      actorId: user.id,
      action: 'attendance.export',
      details: { format, count: records.length, filters: { ...query } },
    });

    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'xlsx') {
      res
        .setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8')
        .setHeader('Content-Disposition', `attachment; filename="attendance-${stamp}.xls"`)
        .send(toSpreadsheetXml(records));
      return;
    }
    res
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="attendance-${stamp}.csv"`)
      .send(toCsv(records));
  }

  @Get('audit')
  @Roles('admin')
  audits(@Query() query: AuditQueryDto) {
    return this.admin.listAudit(query);
  }

  @Get('attendance/:id')
  @Roles('admin', 'supervisor')
  getOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.admin.getRecord(user, id);
  }

  @Patch('attendance/:id')
  @Roles('admin', 'supervisor')
  review(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RecordReviewDto,
  ) {
    return this.admin.reviewRecord(user, id, dto);
  }
}
