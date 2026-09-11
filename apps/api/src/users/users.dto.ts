import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Role } from '@ams/shared';

const ROLES = ['worker', 'supervisor', 'admin'] as const;

export class UserCreateDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsIn(ROLES) role!: Role;
  @IsString() @MinLength(1) @MaxLength(64) employeeCode!: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsString() assignedSiteId?: string | null;
  @IsString() @MinLength(8) @MaxLength(256) password!: string;
}

export class UserUpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @IsOptional() @IsIn(ROLES) role?: Role;
  @IsOptional() @IsString() @MaxLength(32) phone?: string | null;
  @IsOptional() @IsString() assignedSiteId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(256) password?: string;
}
