import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.module';
import { reminders, bookingSessions, notifications } from '../database/schema';

@Injectable()
export class ReminderDeliveryService {
  constructor(private readonly database: DatabaseService) {}

  async deliver(id: string): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      const [initial] = await tx
        .select()
        .from(reminders)
        .where(eq(reminders.id, id));
      if (!initial || initial.status !== 'pending') {
        return;
      }
      // Same booking-before-reminder order as cancellation/rescheduling.
      const [session] = await tx
        .select()
        .from(bookingSessions)
        .where(eq(bookingSessions.id, initial.sessionId))
        .for('update');
      const [reminder] = await tx
        .select()
        .from(reminders)
        .where(eq(reminders.id, id))
        .for('update');
      if (reminder.status !== 'pending') {
        return;
      }
      const now = new Date();
      if (session.status !== 'active') {
        await tx
          .update(reminders)
          .set({ status: 'cancelled' })
          .where(eq(reminders.id, id));

        return;
      }
      if (session.startAt <= now) {
        await tx
          .update(reminders)
          .set({ status: 'skipped' })
          .where(eq(reminders.id, id));

        return;
      }
      if (reminder.dueAt > now) {
        throw new Error('Reminder is not due yet');
      }
      await tx.insert(notifications).values({
        recipientId: reminder.recipientId,
        type: reminder.type === '24h' ? 'reminder_24h' : 'reminder_1h',
        sessionId: session.id,
        data: { reminderId: id, startAt: session.startAt.toISOString() },
      });
      await tx
        .update(reminders)
        .set({ status: 'sent' })
        .where(eq(reminders.id, id));
    });
  }
}
