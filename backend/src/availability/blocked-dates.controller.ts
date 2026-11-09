import {
  BulkBlockedDatesDto,
  BulkBlockedDatesResponseDto,
} from './dto/blocked-dates.dto';
import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiSecurity,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SessionGuard } from '../common/guards/session.guard';
import {
  CurrentUser,
  type SessionUser,
} from '../common/decorators/current-user';
import { ProblemDetailsResponseDto } from '../common/dto/problem-details-response.dto';
import { BlockedDatesService } from './blocked-dates.service';
import {
  BlockedDatesResponseDto,
  SaveBlockedDateDto,
  SaveBlockedDateResponseDto,
} from './dto/blocked-dates.dto';

@ApiTags('Blocked dates')
@ApiSecurity('bearer')
@ApiSecurity('session')
@UseGuards(SessionGuard)
@ApiResponse({ status: 400, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 401, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 403, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 404, type: ProblemDetailsResponseDto })
@Controller({ path: 'blocked-dates', version: '1' })
export class BlockedDatesController {
  constructor(private readonly dates: BlockedDatesService) {}

  @ApiOperation({ summary: 'List my blocked dates' })
  @ApiResponse({ status: 200, type: BlockedDatesResponseDto })
  @Get()
  list(@CurrentUser() user: SessionUser): Promise<BlockedDatesResponseDto> {
    return this.dates.list(user.userId);
  }

  @ApiOperation({
    summary: 'Block a professional-local calendar date',
    description:
      'Upserts the date; existing sessions are preserved and returned as warnings.',
  })
  @ApiResponse({ status: 200, type: SaveBlockedDateResponseDto })
  @Put()
  save(
    @CurrentUser() user: SessionUser,
    @Body() dto: SaveBlockedDateDto,
  ): Promise<SaveBlockedDateResponseDto> {
    return this.dates.save(user.userId, dto);
  }

  @ApiOperation({ summary: 'Remove my blocked date' })
  @ApiResponse({ status: 204 })
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.dates.remove(user.userId, id);
  }

  @Put('bulk')
  @ApiOperation({
    summary: 'Block multiple local dates atomically',
    description:
      'All dates save together; booked sessions are preserved and returned as post-save warnings.',
  })
  @ApiResponse({ status: 200, type: BulkBlockedDatesResponseDto })
  bulk(
    @CurrentUser() user: SessionUser,
    @Body() dto: BulkBlockedDatesDto,
  ): Promise<BulkBlockedDatesResponseDto> {
    return this.dates.saveMany(user.userId, dto);
  }
}
