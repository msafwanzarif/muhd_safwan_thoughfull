import { sessionWithinHours } from './domain/session-within-hours';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.module';
import { users, workingHours, bookingSessions } from '../database/schema';
import { validateWorkingHours } from './domain/working-hours';
import {
  SaveWorkingHoursDto,
  SaveWorkingHoursResponseDto,
  WorkingHoursResponseDto,
} from './dto/working-hours.dto';

@Injectable()
export class AvailabilityService {
  constructor(private readonly database: DatabaseService) {}

  async get(userId: string): Promise<WorkingHoursResponseDto> {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    if (!user || user.role !== 'professional') {
      throw new ForbiddenException(
        'Only professionals can manage working hours',
      );
    }
    const ranges = await this.database.db
      .select({
        weekday: workingHours.weekday,
        startMinute: workingHours.startMinute,
        lengthHours: workingHours.lengthHours,
      })
      .from(workingHours)
      .where(eq(workingHours.professionalId, userId))
      .orderBy(workingHours.weekday, workingHours.startMinute);

    return { timezone: user.timezone, ranges };
  }

  async save(
    userId: string,
    dto: SaveWorkingHoursDto,
  ): Promise<SaveWorkingHoursResponseDto> {
    try {
      validateWorkingHours(dto.ranges);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    return this.database.db.transaction(async (tx) => {
      // Serializes weekly replacements and future timezone updates for this account.
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for('update');
      if (!user || user.role !== 'professional') {
        throw new ForbiddenException(
          'Only professionals can manage working hours',
        );
      }
      await tx
        .delete(workingHours)
        .where(eq(workingHours.professionalId, userId));
      if (dto.ranges.length) {
        await tx.insert(workingHours).values(
          dto.ranges.map((range) => ({
            ...range,
            professionalId: userId,
            createdBy: userId,
            updatedBy: userId,
          })),
        );
      }
      const existing = await tx
        .select()
        .from(bookingSessions)
        .where(
          and(
            eq(bookingSessions.professionalId, userId),
            eq(bookingSessions.status, 'active'),
            gt(bookingSessions.startAt, sql`now()`),
          ),
        );
      const warnings = existing
        .filter(
          (session) =>
            !sessionWithinHours(
              session.startAt,
              session.endAt,
              user.timezone,
              dto.ranges,
            ),
        )
        .map((session) => ({
          id: session.id,
          startAt: session.startAt.toISOString(),
          endAt: session.endAt.toISOString(),
        }));

      return {
        timezone: user.timezone,
        ranges: [...dto.ranges].sort(
          (a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute,
        ),
        warnings,
      };
    });
  }
}
