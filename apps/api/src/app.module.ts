import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_CONFIG, loadConfig } from './config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { GeofenceModule } from './geofence/geofence.module';
import { GeocodeModule } from './geocode/geocode.module';
import { ImagesModule } from './images/images.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { SitesModule } from './sites/sites.module';
import { RetentionModule } from './retention/retention.module';
import { HealthModule } from './health/health.module';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: loadConfig }],
  exports: [APP_CONFIG],
})
class AppConfigModule {}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AppConfigModule,
    PrismaModule,
    AuditModule,
    AuthModule,
    GeofenceModule,
    GeocodeModule,
    ImagesModule,
    AttendanceModule,
    AdminModule,
    UsersModule,
    SitesModule,
    RetentionModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
