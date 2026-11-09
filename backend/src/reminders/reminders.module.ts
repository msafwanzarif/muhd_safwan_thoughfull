import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReminderQueueService } from './reminder-queue.service';
import { ReminderDeliveryService } from './reminder-delivery.service';
import { RemindersProcessor } from './reminders.processor';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: 'reminders' })],
  providers: [
    ReminderQueueService,
    ReminderDeliveryService,
    RemindersProcessor,
  ],
  exports: [ReminderQueueService],
})
export class RemindersModule {}
