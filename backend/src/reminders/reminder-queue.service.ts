import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../database/database.module';
import { reminders } from '../database/schema';

@Injectable()
export class ReminderQueueService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private timer?: ReturnType<typeof setInterval>;

  private running?: Promise<void>;

  private readonly logger = new Logger(ReminderQueueService.name);

  constructor(
    private readonly database: DatabaseService,
    @InjectQueue('reminders') private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.reconcile();
    this.timer = setInterval(() => {
      void this.reconcile();
    }, 15000);
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
    await this.running;
  }

  async syncSession(sessionId: string): Promise<void> {
    try {
      await this.sync(
        await this.database.db
          .select()
          .from(reminders)
          .where(eq(reminders.sessionId, sessionId)),
      );
    } catch {
      this.logger.warn(
        'Reminder queue synchronization failed; reconciliation will retry',
      );
    }
  }

  async reconcile(): Promise<void> {
    if (this.running) {
      return this.running;
    }
    this.running = (async () => {
      try {
        await this.sync(
          await this.database.db
            .select()
            .from(reminders)
            .where(inArray(reminders.status, ['pending', 'cancelled'])),
        );
      } catch {
        this.logger.warn('Reminder recovery failed; reconciliation will retry');
      }
    })().finally(() => {
      this.running = undefined;
    });

    return this.running;
  }

  private async sync(rows: (typeof reminders.$inferSelect)[]): Promise<void> {
    for (const reminder of rows) {
      const existing = await this.queue.getJob(reminder.id);
      if (reminder.status !== 'pending') {
        if (existing && (await existing.getState()) !== 'active') {
          await existing.remove();
        }
        continue;
      }
      if (existing) {
        const state = await existing.getState();
        if (state !== 'failed' && state !== 'completed') {
          continue;
        }
        await existing.remove();
      }
      await this.queue.add(
        'deliver',
        { reminderId: reminder.id },
        {
          jobId: reminder.id,
          delay: Math.max(0, reminder.dueAt.getTime() - Date.now()),
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: 1000,
        },
      );
    }
  }
}
