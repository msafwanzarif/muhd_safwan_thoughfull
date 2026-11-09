import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gt, lt } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { DatabaseService } from '../database/database.module';
import { users, blockedDates, bookingSessions } from '../database/schema';
import {
  BlockedDatesResponseDto,
  SaveBlockedDateDto,
  SaveBlockedDateResponseDto,
} from './dto/blocked-dates.dto';

@Injectable()
export class BlockedDatesService {
  constructor(private readonly database: DatabaseService) {}

  private async professional(id: string) {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, id));
    if (!user || user.role !== 'professional') {
      throw new ForbiddenException(
        'Only professionals can manage blocked dates',
      );
    }

    return user;
  }

  async list(id: string): Promise<BlockedDatesResponseDto> {
    const user = await this.professional(id);
    const rows = await this.database.db
      .select({
        id: blockedDates.id,
        localDate: blockedDates.localDate,
        reason: blockedDates.reason,
      })
      .from(blockedDates)
      .where(eq(blockedDates.professionalId, id))
      .orderBy(blockedDates.localDate);

    return { timezone: user.timezone, items: rows };
  }

  async save(
    id: string,
    dto: SaveBlockedDateDto,
  ): Promise<SaveBlockedDateResponseDto> {
    return this.database.db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, id))
        .for('update');
      if (!user || user.role !== 'professional') {
        throw new ForbiddenException(
          'Only professionals can manage blocked dates',
        );
      }
      const day = DateTime.fromISO(dto.localDate, { zone: user.timezone });
      if (!day.isValid || day.toISODate() !== dto.localDate) {
        throw new BadRequestException('Invalid calendar date');
      }
      const [blocked] = await tx
        .insert(blockedDates)
        .values({
          professionalId: id,
          localDate: dto.localDate,
          reason: dto.reason ?? null,
          createdBy: id,
          updatedBy: id,
        })
        .onConflictDoUpdate({
          target: [blockedDates.professionalId, blockedDates.localDate],
          set: { reason: dto.reason ?? null, updatedBy: id },
        })
        .returning();
      const sessions = await tx
        .select()
        .from(bookingSessions)
        .where(
          and(
            eq(bookingSessions.professionalId, id),
            eq(bookingSessions.status, 'active'),
            lt(bookingSessions.startAt, day.plus({ days: 1 }).toJSDate()),
            gt(bookingSessions.endAt, day.toJSDate()),
          ),
        );

      return {
        id: blocked.id,
        localDate: blocked.localDate,
        reason: blocked.reason,
        warnings: sessions.map((s) => ({
          id: s.id,
          startAt: s.startAt.toISOString(),
          endAt: s.endAt.toISOString(),
        })),
      };
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for('update');
      if (!user || user.role !== 'professional') {
        throw new ForbiddenException(
          'Only professionals can manage blocked dates',
        );
      }
      const deleted = await tx
        .delete(blockedDates)
        .where(
          and(eq(blockedDates.id, id), eq(blockedDates.professionalId, userId)),
        )
        .returning({ id: blockedDates.id });
      if (!deleted.length) {
        throw new NotFoundException('Blocked date not found');
      }
    });
  }
}
