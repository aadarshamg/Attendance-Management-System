import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';

/** Rounding coordinates to ~4dp (~11m) keeps the cache small while staying precise enough. */
function roundKey(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);
  /** Serialises outbound Nominatim calls to respect the <= 1 req/s policy. */
  private chain: Promise<unknown> = Promise.resolve();
  private lastCallAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Reverse-geocode to a display address. Never throws — returns null on any failure. */
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const latKey = roundKey(lat);
    const lngKey = roundKey(lng);

    const cached = await this.prisma.geocodeCache.findUnique({
      where: { latKey_lngKey: { latKey, lngKey } },
    });
    if (cached) return cached.address;

    const address = await this.throttledFetch(latKey, lngKey);

    try {
      await this.prisma.geocodeCache.upsert({
        where: { latKey_lngKey: { latKey, lngKey } },
        create: { latKey, lngKey, address },
        update: { address },
      });
    } catch {
      /* cache write is best-effort */
    }
    return address;
  }

  private throttledFetch(lat: number, lng: number): Promise<string | null> {
    const run = async (): Promise<string | null> => {
      const wait = Math.max(0, 1100 - (Date.now() - this.lastCallAt));
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastCallAt = Date.now();

      const url = new URL('/reverse', this.config.nominatim.baseUrl);
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('zoom', '18');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': this.config.nominatim.userAgent, Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!res.ok) {
          this.logger.warn(`Nominatim returned ${res.status}`);
          return null;
        }
        const body = (await res.json()) as { display_name?: string };
        return body.display_name ?? null;
      } catch (err) {
        this.logger.warn(`Nominatim request failed: ${String(err)}`);
        return null;
      } finally {
        clearTimeout(timeout);
      }
    };

    const result = this.chain.then(run, run);
    this.chain = result.catch(() => undefined);
    return result;
  }
}
