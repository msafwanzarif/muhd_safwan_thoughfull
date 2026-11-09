import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { and, eq, ilike, inArray, sql, count, or, lt, gt } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { DatabaseService } from '../database/database.module';
import {
  users,
  professionalProfiles,
  workingHours,
  blockedDates,
  bookingSessions,
} from '../database/schema';
import { SessionUser } from '../common/decorators/current-user';
import {
  bookingWindowEnd,
  generateSlots,
} from '../slots/domain/generate-slots';
import {
  ProfessionalsQueryDto,
  ProfessionalsPageResponseDto,
} from './dto/professionals.dto';

@Injectable()
export class ProfessionalsService {
  constructor(private readonly database: DatabaseService) {}

  async list(
    member: SessionUser,
    query: ProfessionalsQueryDto,
  ): Promise<ProfessionalsPageResponseDto> {
    if (member.role !== 'member') {
      throw new ForbiddenException('Only members can browse professionals');
    }
    const db = this.database.db;
    const now = new Date();
    const date = query.date
      ? DateTime.fromISO(query.date, { zone: member.timezone })
      : undefined;
    if (date && (!date.isValid || date.toISODate() !== query.date)) {
      throw new BadRequestException('Invalid calendar date');
    }
    const page = (
      items: ProfessionalsPageResponseDto['items'],
      total: number,
    ): ProfessionalsPageResponseDto => ({
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    });
    if (
      date &&
      (date.toMillis() <
        DateTime.fromJSDate(now, { zone: member.timezone })
          .startOf('day')
          .toMillis() ||
        date.toMillis() >= bookingWindowEnd(now, member.timezone).toMillis())
    ) {
      return page([], 0);
    }
    const escaped = query.name
      ?.split('')
      .map((character) =>
        ['%', '_', String.fromCharCode(92)].includes(character)
          ? String.fromCharCode(92) + character
          : character,
      )
      .join('');
    const filter = and(
      eq(users.role, 'professional'),
      escaped ? ilike(users.name, '%' + escaped + '%') : undefined,
      query.specialisation
        ? sql`${professionalProfiles.specialisations} @> ${JSON.stringify([query.specialisation])}::jsonb`
        : undefined,
      query.language
        ? sql`${professionalProfiles.languages} @> ${JSON.stringify([query.language])}::jsonb`
        : undefined,
      date
        ? sql`exists (select 1 from working_hours wh where wh.professional_id = ${users.id} and wh.weekday in (select extract(dow from local_day)::integer from generate_series((${date.toUTC().toISO()}::timestamptz at time zone ${users.timezone})::date, (${date.plus({ days: 1 }).minus({ milliseconds: 1 }).toUTC().toISO()}::timestamptz at time zone ${users.timezone})::date, interval '1 day') local_day))`
        : undefined,
    );
    const selection = {
      id: users.id,
      name: users.name,
      timezone: users.timezone,
      title: professionalProfiles.title,
      bio: professionalProfiles.bio,
      specialisations: professionalProfiles.specialisations,
      languages: professionalProfiles.languages,
      hasWorkingHours: sql<boolean>`exists (select 1 from working_hours wh where wh.professional_id = ${users.id})`,
    };
    const base = db
      .select(selection)
      .from(users)
      .leftJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
      .where(filter)
      .orderBy(users.name, users.id)
      .$dynamic();
    const rows = await (date
      ? base
      : base.limit(query.pageSize).offset((query.page - 1) * query.pageSize));
    const profiles = rows.map((row) => ({
      ...row,
      specialisations: row.specialisations ?? [],
      languages: row.languages ?? [],
    }));
    if (!date) {
      const [totals] = await db
        .select({ total: count() })
        .from(users)
        .leftJoin(
          professionalProfiles,
          eq(professionalProfiles.userId, users.id),
        )
        .where(filter);

      return page(profiles, totals.total);
    }
    if (!profiles.length) {
      return page([], 0);
    }
    const ids = profiles.map((p) => p.id);
    const end = bookingWindowEnd(now, member.timezone).toJSDate();
    const [hours, blocked, sessions] = await Promise.all([
      db
        .select()
        .from(workingHours)
        .where(inArray(workingHours.professionalId, ids)),
      db
        .select()
        .from(blockedDates)
        .where(inArray(blockedDates.professionalId, ids)),
      db
        .select()
        .from(bookingSessions)
        .where(
          and(
            eq(bookingSessions.status, 'active'),
            or(
              inArray(bookingSessions.professionalId, ids),
              eq(bookingSessions.memberId, member.userId),
            ),
            gt(bookingSessions.endAt, now),
            lt(bookingSessions.startAt, end),
          ),
        ),
    ]);
    const matches = profiles.filter((pro) =>
      generateSlots({
        now,
        memberTimezone: member.timezone,
        professionalTimezone: pro.timezone,
        ranges: hours.filter((h) => h.professionalId === pro.id),
        blockedDates: blocked
          .filter((b) => b.professionalId === pro.id)
          .map((b) => b.localDate),
        professionalSessions: sessions.filter(
          (s) => s.professionalId === pro.id,
        ),
        memberSessions: sessions.filter((s) => s.memberId === member.userId),
      }).some(
        (slot) =>
          slot.available &&
          DateTime.fromISO(slot.startAt)
            .setZone(member.timezone)
            .toISODate() === query.date,
      ),
    );

    return page(
      matches.slice(
        (query.page - 1) * query.pageSize,
        query.page * query.pageSize,
      ),
      matches.length,
    );
  }
}
