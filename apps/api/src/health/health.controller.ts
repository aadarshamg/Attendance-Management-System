import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { ImagesService } from '../images/images.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImagesService,
  ) {}

  @Get()
  async check() {
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    return {
      status: db ? 'ok' : 'degraded',
      db,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /** Open in a browser to see whether photo uploads can work, and why not if they can't. */
  @Get('storage')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  storage() {
    return this.images.probe();
  }
}
