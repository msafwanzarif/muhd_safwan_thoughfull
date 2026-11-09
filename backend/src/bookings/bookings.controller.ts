import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiSecurity,
  ApiOperation,
  ApiHeader,
  ApiResponse,
} from '@nestjs/swagger';
import { SessionGuard } from '../common/guards/session.guard';
import {
  CurrentUser,
  type SessionUser,
} from '../common/decorators/current-user';
import { ProblemDetailsResponseDto } from '../common/dto/problem-details-response.dto';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';

@ApiTags('Sessions')
@ApiSecurity('bearer')
@ApiSecurity('session')
@UseGuards(SessionGuard)
@ApiResponse({ status: 400, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 401, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 403, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 404, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 409, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 422, type: ProblemDetailsResponseDto })
@Controller({ path: 'sessions', version: '1' })
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @ApiOperation({
    summary: 'Book a professional session',
    description:
      'Member only. Server regenerates slots. Retry the same payload with the same key to replay the original 201 response for 24 hours.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Random UUID or 16–128 letters, digits, hyphens or underscores',
  })
  @ApiResponse({ status: 201, type: BookingResponseDto })
  @Post()
  create(
    @CurrentUser() member: SessionUser,
    @Body() dto: CreateBookingDto,
    @Headers('idempotency-key') key: string,
  ): Promise<BookingResponseDto> {
    return this.bookings.create(member, dto, key);
  }
}
