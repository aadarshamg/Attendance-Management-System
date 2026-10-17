import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PIN_PATTERN } from '@ams/shared';

export class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  employeeCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

export class PinLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone!: string;

  @IsString()
  @Matches(PIN_PATTERN)
  pin!: string;
}
