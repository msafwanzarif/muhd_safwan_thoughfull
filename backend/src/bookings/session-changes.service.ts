import { Optional } from '@nestjs/common';
import { createReminderRecords } from '../reminders/reminder-records';
import { ReminderQueueService } from '../reminders/reminder-queue.service';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import {
  bookingSessions,
  users,
  reminders,
  notifications,
} from '../database/schema';
import { SessionUser } from '../common/decorators/current-user';
import {
  IdempotencyService,
  type DatabaseTransaction,
} from '../common/idempotency/idempotency.service';
import { SlotsService } from '../slots/slots.service';
import { canMemberChangeSession } from './domain/cancellation-rules';
import {
  CancelSessionDto,
  CancelSessionResponseDto,
  RescheduleSessionDto,
  RescheduleSessionResponseDto,
} from './dto/change-session.dto';

@Injectable()
export class SessionChangesService {
  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly slots: SlotsService,
    @Optional() private readonly reminderQueue?: ReminderQueueService,
  ) {}

  private async lock(tx: DatabaseTransaction, user: SessionUser, id: string) {
    const ownership =
      user.role === 'member'
        ? eq(bookingSessions.memberId, user.userId)
        : eq(bookingSessions.professionalId, user.userId);
    const [initial] = await tx
      .select()
      .from(bookingSessions)
      .where(and(eq(bookingSessions.id, id), ownership));
    if (!initial) {
      throw new NotFoundException('Session not found');
    }
    // Match the account lock order used by booking creation and availability updates.
    await tx
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, [initial.memberId, initial.professionalId]))
      .orderBy(users.id)
      .for('update');
    const [session] = await tx
      .select()
      .from(bookingSessions)
      .where(and(eq(bookingSessions.id, id), ownership))
      .for('update');
    if (session.status !== 'active') {
      throw new ConflictException({
        message: 'Session is no longer active',
        code: 'SESSION_NOT_ACTIVE',
      });
    }
    if (
      user.role === 'member' &&
      !canMemberChangeSession(session.startAt, new Date())
    ) {
      throw new ForbiddenException({
        message: 'Changes require at least 24 hours notice',
        code: 'WITHIN_24_HOURS',
      });
    }

    return session;
  }

  private async cancelReminders(tx: DatabaseTransaction, id: string) {
    await tx
      .update(reminders)
      .set({ status: 'cancelled' })
      .where(and(eq(reminders.sessionId, id), eq(reminders.status, 'pending')));
  }

  async cancel(
    user: SessionUser,
    id: string,
    dto: CancelSessionDto,
    key: string,
  ): Promise<CancelSessionResponseDto> {
    return this.idempotency
      .execute<CancelSessionResponseDto>(
        user.userId,
        key,
        JSON.stringify({
          method: 'POST',
          path: '/api/v1/sessions/' + id + '/cancel',
          reason: dto.reason ?? null,
        }),
        async (tx) => {
          const session = await this.lock(tx, user, id);
          const now = new Date();
          await tx
            .update(bookingSessions)
            .set({
              status: 'cancelled',
              cancelledBy: user.userId,
              cancelledAt: now,
              reason: dto.reason ?? null,
              updatedBy: user.userId,
            })
            .where(eq(bookingSessions.id, id));
          await this.cancelReminders(tx, id);
          const [actor] = await tx
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, user.userId));
          await tx.insert(notifications).values({
            recipientId:
              user.role === 'member'
                ? session.professionalId
                : session.memberId,
            type: 'session_cancelled',
            sessionId: id,
            data: {
              startAt: session.startAt.toISOString(),
              cancelledByRole: user.role,
              participantName: actor.name,
              reason: dto.reason ?? null,
            },
          });

          return {
            id,
            status: 'cancelled',
            cancelledBy: user.userId,
            cancelledAt: now.toISOString(),
            reason: dto.reason ?? null,
          };
        },
        200,
      )
      .then(async (result) => {
        await this.reminderQueue?.syncSession(id);

        return result;
      });
  }

  async reschedule(
    user: SessionUser,
    id: string,
    dto: RescheduleSessionDto,
    key: string,
  ): Promise<RescheduleSessionResponseDto> {
    if (user.role !== 'member') {
      throw new ForbiddenException('Only members can reschedule sessions');
    }
    const startAt = new Date(dto.startAt).toISOString();

    return this.idempotency
      .execute<RescheduleSessionResponseDto>(
        user.userId,
        key,
        JSON.stringify({
          method: 'POST',
          path: '/api/v1/sessions/' + id + '/reschedule',
          startAt,
        }),
        async (tx) => {
          const original = await this.lock(tx, user, id);
          if (original.startAt.toISOString() === startAt) {
            throw new ConflictException({
              message: 'Choose a different slot',
              code: 'SAME_SLOT',
            });
          }
          // Release the old range first; failure later rolls this change back via savepoint.
          await tx
            .update(bookingSessions)
            .set({ status: 'rescheduled', updatedBy: user.userId })
            .where(eq(bookingSessions.id, id));
          const available = await this.slots.list(
            original.professionalId,
            user,
            tx,
          );
          const slot = available.slots.find(
            (s) => s.startAt === startAt && s.available,
          );
          if (!slot) {
            throw new ConflictException({
              message: 'The new slot is unavailable or invalid',
              code: 'SLOT_TAKEN',
            });
          }
          const [session] = await tx
            .insert(bookingSessions)
            .values({
              memberId: original.memberId,
              professionalId: original.professionalId,
              startAt: new Date(slot.startAt),
              endAt: new Date(slot.endAt),
              rescheduledFromId: id,
              createdBy: user.userId,
              updatedBy: user.userId,
            })
            .returning();
          await createReminderRecords(tx, session);
          await this.cancelReminders(tx, id);
          const [actor] = await tx
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, user.userId));
          await tx.insert(notifications).values({
            recipientId: original.professionalId,
            type: 'session_rescheduled',
            sessionId: session.id,
            data: {
              participantName: actor.name,
              previousSessionId: id,
              previousStartAt: original.startAt.toISOString(),
              startAt: session.startAt.toISOString(),
            },
          });

          return {
            previousSessionId: id,
            session: {
              id: session.id,
              memberId: session.memberId,
              professionalId: session.professionalId,
              startAt: session.startAt.toISOString(),
              endAt: session.endAt.toISOString(),
              status: 'active',
            },
          };
        },
        200,
      )
      .then(async (result) => {
        await this.reminderQueue?.syncSession(id);
        await this.reminderQueue?.syncSession(result.session.id);

        return result;
      });
  }
}
