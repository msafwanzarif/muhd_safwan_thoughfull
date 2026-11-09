import { reminders } from '../database/schema';
import type { DatabaseTransaction } from '../common/idempotency/idempotency.service';
import { reminderSchedule } from './domain/schedule-reminders';

export async function createReminderRecords(
  tx: DatabaseTransaction,
  session: {
    id: string;
    memberId: string;
    professionalId: string;
    startAt: Date;
  },
): Promise<void> {
  const rows = reminderSchedule(session.startAt, new Date()).flatMap(
    (reminder) =>
      [session.memberId, session.professionalId].map((recipientId) => ({
        sessionId: session.id,
        recipientId,
        ...reminder,
      })),
  );
  if (rows.length) {
    await tx.insert(reminders).values(rows).onConflictDoNothing();
  }
}
