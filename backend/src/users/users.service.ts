import { sessionWithinHours } from '../availability/domain/session-within-hours';
import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import { DatabaseService } from '../database/database.module';
import { users, workingHours, bookingSessions } from '../database/schema';
import { validateWorkingHours } from '../availability/domain/working-hours';
import { ChangeTimezoneDto, TimezoneResponseDto } from './dto/timezone.dto';

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  async timezone(
    userId: string,
    dto: ChangeTimezoneDto,
  ): Promise<TimezoneResponseDto> {
    return this.database.db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for('update');
      if (user.role === 'member' && dto.ranges !== undefined) {
        throw new BadRequestException('Only professionals have working hours');
      }
      if (user.role === 'professional' && !Array.isArray(dto.ranges)) {
        throw new BadRequestException(
          'Professionals must submit their complete working week in the new timezone',
        );
      }
      if (dto.ranges) {
        try {
          validateWorkingHours(dto.ranges);
        } catch (e) {
          throw new BadRequestException((e as Error).message);
        }
      }
      const ranges = user.role === 'professional' ? dto.ranges! : [];
      if (user.role === 'professional') {
        await tx
          .delete(workingHours)
          .where(eq(workingHours.professionalId, userId));
        if (ranges.length) {
          await tx.insert(workingHours).values(
            ranges.map((r) => ({
              ...r,
              professionalId: userId,
              createdBy: userId,
              updatedBy: userId,
            })),
          );
        }
      }
      await tx
        .update(users)
        .set({ timezone: dto.timezone })
        .where(eq(users.id, userId));
      const sessions =
        user.role === 'professional'
          ? await tx
              .select()
              .from(bookingSessions)
              .where(
                and(
                  eq(bookingSessions.professionalId, userId),
                  eq(bookingSessions.status, 'active'),
                  gt(bookingSessions.startAt, new Date()),
                ),
              )
          : [];
      const warnings = sessions
        .filter(
          (s) => !sessionWithinHours(s.startAt, s.endAt, dto.timezone, ranges),
        )
        .map((s) => ({
          id: s.id,
          startAt: s.startAt.toISOString(),
          endAt: s.endAt.toISOString(),
        }));

      return { timezone: dto.timezone, ranges, warnings };
    });
  }
}
