import { BlockedDatesController } from './blocked-dates.controller';
import { BlockedDatesService } from './blocked-dates.service';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

@Module({
  imports: [AuthModule],
  controllers: [AvailabilityController, BlockedDatesController],
  providers: [AvailabilityService, BlockedDatesService],
})
export class AvailabilityModule {}
