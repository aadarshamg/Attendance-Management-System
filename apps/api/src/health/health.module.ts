import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ImagesModule } from '../images/images.module';

@Module({ imports: [ImagesModule], controllers: [HealthController] })
export class HealthModule {}
