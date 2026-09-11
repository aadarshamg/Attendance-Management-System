import { Module } from '@nestjs/common';
import { GeofenceModule } from '../geofence/geofence.module';
import { GeocodeModule } from '../geocode/geocode.module';
import { ImagesModule } from '../images/images.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [GeofenceModule, GeocodeModule, ImagesModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
