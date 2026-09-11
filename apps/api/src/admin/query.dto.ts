import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import type { RecordStatus } from '@ams/shared';

export class AdminRecordQueryDto {
  @IsOptional() @IsString() workerId?: string;
  @IsOptional() @IsString() siteId?: string;
  @IsOptional() @IsISO8601() dateFrom?: string;
  @IsOptional() @IsISO8601() dateTo?: string;
  @IsOptional() @IsIn(['ok', 'flagged']) status?: RecordStatus;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit = 25;
}

export class RecordReviewDto {
  @IsIn(['ok', 'flagged']) status!: RecordStatus;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class AuditQueryDto {
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() actorId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit = 50;
}
