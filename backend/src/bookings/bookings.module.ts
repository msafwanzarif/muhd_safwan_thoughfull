import { SessionChangesService } from './session-changes.service';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SlotsModule } from '../slots/slots.module';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AuthModule, SlotsModule],
  providers: [BookingsService, IdempotencyService, SessionChangesService],
  controllers: [BookingsController],
})
export class BookingsModule {}
