import { Type } from 'class-transformer';
import { IsIn, IsISO8601, IsNumber, Max, Min } from 'class-validator';
import type { MarkType } from '@ams/shared';

export class MarkDto {
  @IsIn(['check_in', 'check_out'])
  markType!: MarkType;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  gpsAccuracyM!: number;

  @IsISO8601()
  deviceTimestamp!: string;
}
