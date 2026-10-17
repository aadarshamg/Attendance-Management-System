import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser, ConsentResponse, LoginResponse } from '@ams/shared';
import { AuthService } from './auth.service';
import { LoginDto, PinLoginDto } from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { RequestUser } from './jwt.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.auth.login(dto.employeeCode, dto.password);
  }

  // Looser per-IP limit than /login: a whole crew on one site Wi-Fi signs in together at
  // shift start. Guessing is stopped per account instead (PIN_MAX_ATTEMPTS, then a lock).
  @Post('pin-login')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  pinLogin(@Body() dto: PinLoginDto): Promise<LoginResponse> {
    return this.auth.pinLogin(dto.phone, dto.pin);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestUser): Promise<AuthUser> {
    return this.auth.me(user.id);
  }

  @Post('consent')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  consent(@CurrentUser() user: RequestUser): Promise<ConsentResponse> {
    return this.auth.giveConsent(user.id);
  }
}
