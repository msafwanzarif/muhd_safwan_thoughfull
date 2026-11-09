import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ReminderDeliveryService } from './reminder-delivery.service';

@Processor('reminders')
export class RemindersProcessor extends WorkerHost {
  constructor(private readonly delivery: ReminderDeliveryService) {
    super();
  }

  async process(job: Job<{ reminderId: string }>): Promise<void> {
    await this.delivery.deliver(job.data.reminderId);
  }
}
