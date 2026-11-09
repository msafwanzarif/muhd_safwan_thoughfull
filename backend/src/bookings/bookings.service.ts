import { BadRequestException } from '@nestjs/common';
import { gt, lte, gte, lt, desc } from 'drizzle-orm';
import { Optional } from '@nestjs/common';
import { createReminderRecords } from '../reminders/reminder-records';
import { ReminderQueueService } from '../reminders/reminder-queue.service';
import { NotFoundException } from '@nestjs/common';
import { alias } from 'drizzle-orm/pg-core';
import { and, eq, count } from 'drizzle-orm';
import { DatabaseService } from '../database/database.module';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import {
  SessionResponseDto,
  SessionsPageResponseDto,
} from './dto/session-response.dto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { users, bookingSessions } from '../database/schema';
import { SlotsService } from '../slots/slots.service';
import { SessionUser } from '../common/decorators/current-user';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';

@Injectable()
export class BookingsService {
  constructor(
    private readonly slots: SlotsService,
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    @Optional() private readonly reminderQueue?: ReminderQueueService,
  ) {}

  private participantFilter(user: SessionUser) {
    return user.role === 'member'
      ? eq(bookingSessions.memberId, user.userId)
      : eq(bookingSessions.professionalId, user.userId);
  }

  private sessionQuery() {
    const successor = alias(bookingSessions, 'successor');
    const member = alias(users, 'member');
    const professional = alias(users, 'professional');

    return this.database.db
      .select({
        id: bookingSessions.id,
        createdAt: bookingSessions.createdAt,
        cancelledAt: bookingSessions.cancelledAt,
        cancelledBy: bookingSessions.cancelledBy,
        reason: bookingSessions.reason,
        rescheduledFromId: bookingSessions.rescheduledFromId,
        rescheduledToId: successor.id,
        startAt: bookingSessions.startAt,
        endAt: bookingSessions.endAt,
        status: bookingSessions.status,
        member: { id: member.id, name: member.name, timezone: member.timezone },
        professional: {
          id: professional.id,
          name: professional.name,
          timezone: professional.timezone,
        },
      })
      .from(bookingSessions)
      .leftJoin(successor, eq(successor.rescheduledFromId, bookingSessions.id))
      .innerJoin(member, eq(member.id, bookingSessions.memberId))
      .innerJoin(
        professional,
        eq(professional.id, bookingSessions.professionalId),
      );
  }

  async list(
    user: SessionUser,
    query: ListSessionsQueryDto,
  ): Promise<SessionsPageResponseDto> {
    if (query.status && query.statuses) {
      throw new BadRequestException('Choose status or statuses, not both');
    }
    if (
      query.from &&
      query.to &&
      Date.parse(query.from) >= Date.parse(query.to)
    ) {
      throw new BadRequestException('from must be before to');
    }
    const now = new Date();
    const filter = and(
      this.participantFilter(user),
      query.status ? eq(bookingSessions.status, query.status) : undefined,
      query.statuses
        ? inArray(bookingSessions.status, query.statuses)
        : undefined,
      query.period === 'upcoming'
        ? gt(bookingSessions.endAt, now)
        : query.period === 'past'
          ? lte(bookingSessions.endAt, now)
          : undefined,
      query.from
        ? gte(bookingSessions.startAt, new Date(query.from))
        : undefined,
      query.to ? lt(bookingSessions.startAt, new Date(query.to)) : undefined,
    );
    const [rows, [totals]] = await Promise.all([
      this.sessionQuery()
        .where(filter)
        .orderBy(
          query.period === 'past'
            ? desc(bookingSessions.startAt)
            : bookingSessions.startAt,
          query.period === 'past'
            ? desc(bookingSessions.id)
            : bookingSessions.id,
        )
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.database.db
        .select({ total: count() })
        .from(bookingSessions)
        .where(filter),
    ]);

    return {
      items: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        cancelledAt: row.cancelledAt?.toISOString() ?? null,
        startAt: row.startAt.toISOString(),
        endAt: row.endAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total: totals.total,
      totalPages: Math.ceil(totals.total / query.pageSize),
    };
  }

  async get(user: SessionUser, id: string): Promise<SessionResponseDto> {
    const [row] = await this.sessionQuery().where(
      and(eq(bookingSessions.id, id), this.participantFilter(user)),
    );
    if (!row) {
      throw new NotFoundException('Session not found');
    }

    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
    };
  }

  async create(
    member: SessionUser,
    dto: CreateBookingDto,
    key: string,
  ): Promise<BookingResponseDto> {
    if (member.role !== 'member') {
      throw new ForbiddenException('Only members can book sessions');
    }
    const startAt = new Date(dto.startAt).toISOString();
    try {
      const result = await this.idempotency.execute<BookingResponseDto>(
        member.userId,
        key,
        JSON.stringify({
          method: 'POST',
          path: '/api/v1/sessions',
          professionalId: dto.professionalId,
          startAt,
        }),
        async (tx) => {
          // Ordered account locks serialize member and professional changes and bookings.
          await tx
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, [member.userId, dto.professionalId]))
            .orderBy(users.id)
            .for('update');
          const result = await this.slots.list(dto.professionalId, member, tx);
          const slot = result.slots.find(
            (s) => s.startAt === startAt && s.available,
          );
          if (!slot) {
            throw new ConflictException({
              message: 'The slot is unavailable or no longer valid',
              code: 'SLOT_TAKEN',
            });
          }
          const [booking] = await tx
            .insert(bookingSessions)
            .values({
              memberId: member.userId,
              professionalId: dto.professionalId,
              startAt: new Date(slot.startAt),
              endAt: new Date(slot.endAt),
              createdBy: member.userId,
              updatedBy: member.userId,
            })
            .returning();

          await createReminderRecords(tx, booking);

          return {
            id: booking.id,
            memberId: booking.memberId,
            professionalId: booking.professionalId,
            startAt: booking.startAt.toISOString(),
            endAt: booking.endAt.toISOString(),
            status: 'active',
          };
        },
      );
      await this.reminderQueue?.syncSession(result.id);

      return result;
    } catch (error) {
      const cause = error as { code?: string; cause?: { code?: string } };
      if (['23P01', '40P01'].includes(cause.cause?.code ?? cause.code ?? '')) {
        throw new ConflictException({
          message: 'The slot was taken by another booking',
          code: 'SLOT_TAKEN',
        });
      }
      throw error;
    }
  }
}
