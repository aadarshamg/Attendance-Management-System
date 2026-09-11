import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { MarkResponse } from '@ams/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/jwt.types';
import { AttendanceService } from './attendance.service';
import { MarkDto } from './mark.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('mark')
  @Roles('worker')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES ?? 614400), files: 1 },
    }),
  )
  mark(
    @CurrentUser() user: RequestUser,
    @Body() dto: MarkDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<MarkResponse> {
    return this.attendance.mark(user, dto, file);
  }

  @Get('me')
  @Roles('worker')
  myRecords(
    @CurrentUser() user: RequestUser,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    return this.attendance.myRecords(user.id, Number(page) || 1, Math.min(Number(limit) || 25, 200));
  }
}
