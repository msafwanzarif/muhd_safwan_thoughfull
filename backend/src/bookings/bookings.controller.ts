import { Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import {
  SessionResponseDto,
  SessionsPageResponseDto,
} from './dto/session-response.dto';
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
    summary: 'List my sessions',
    description:
      'Member or professional sessions selected from the authenticated identity. Ordered by start time, then ID. Includes all statuses unless filtered. Participant emails are never returned.',
  })
  @ApiResponse({ status: 200, type: SessionsPageResponseDto })
  @Get()
  list(
    @CurrentUser() user: SessionUser,
    @Query() query: ListSessionsQueryDto,
  ): Promise<SessionsPageResponseDto> {
    return this.bookings.list(user, query);
  }

  @ApiOperation({
    summary: 'Get my session',
    description:
      'Only session participants can access it. Unrelated and nonexistent sessions return the same 404.',
  })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  @Get(':id')
  get(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SessionResponseDto> {
    return this.bookings.get(user, id);
  }

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
