import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gt, lt } from 'drizzle-orm';
import { DatabaseService } from '../database/database.module';
import {
  users,
  workingHours,
  blockedDates,
  bookingSessions,
} from '../database/schema';
import { SessionUser } from '../common/decorators/current-user';
import { bookingWindowEnd, generateSlots } from './domain/generate-slots';
import { SlotsResponseDto } from './dto/slots-response.dto';

@Injectable()
export class SlotsService {
  constructor(private readonly database: DatabaseService) {}

  async list(
    professionalId: string,
    member: SessionUser,
  ): Promise<SlotsResponseDto> {
    if (member.role !== 'member') {
      throw new ForbiddenException('Only members can browse booking slots');
    }
    const db = this.database.db;
    const [professional] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, professionalId), eq(users.role, 'professional')));
    if (!professional) {
      throw new NotFoundException('Professional not found');
    }
    const now = new Date(),
      end = bookingWindowEnd(now, member.timezone).toJSDate();
    const [ranges, blocked, professionalSessions, memberSessions] =
      await Promise.all([
        db
          .select()
          .from(workingHours)
          .where(eq(workingHours.professionalId, professionalId)),
        db
          .select({ date: blockedDates.localDate })
          .from(blockedDates)
          .where(eq(blockedDates.professionalId, professionalId)),
        db
          .select({
            startAt: bookingSessions.startAt,
            endAt: bookingSessions.endAt,
          })
          .from(bookingSessions)
          .where(
            and(
              eq(bookingSessions.professionalId, professionalId),
              eq(bookingSessions.status, 'active'),
              gt(bookingSessions.endAt, now),
              lt(bookingSessions.startAt, end),
            ),
          ),
        db
          .select({
            startAt: bookingSessions.startAt,
            endAt: bookingSessions.endAt,
          })
          .from(bookingSessions)
          .where(
            and(
              eq(bookingSessions.memberId, member.userId),
              eq(bookingSessions.status, 'active'),
              gt(bookingSessions.endAt, now),
              lt(bookingSessions.startAt, end),
            ),
          ),
      ]);

    return {
      professionalId,
      professionalTimezone: professional.timezone,
      memberTimezone: member.timezone,
      slots: generateSlots({
        now,
        memberTimezone: member.timezone,
        professionalTimezone: professional.timezone,
        ranges,
        blockedDates: blocked.map((b) => b.date),
        professionalSessions,
        memberSessions,
      }),
    };
  }
}
