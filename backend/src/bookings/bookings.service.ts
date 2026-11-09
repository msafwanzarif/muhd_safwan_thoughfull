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
    private readonly idempotency: IdempotencyService,
  ) {}

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
      return await this.idempotency.execute(
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
