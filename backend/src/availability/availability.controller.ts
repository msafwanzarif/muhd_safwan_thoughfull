import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { SessionGuard } from '../common/guards/session.guard';
import {
  CurrentUser,
  type SessionUser,
} from '../common/decorators/current-user';
import { ProblemDetailsResponseDto } from '../common/dto/problem-details-response.dto';
import { AvailabilityService } from './availability.service';
import {
  SaveWorkingHoursDto,
  SaveWorkingHoursResponseDto,
  WorkingHoursResponseDto,
} from './dto/working-hours.dto';

@ApiTags('Working hours')
@ApiSecurity('bearer')
@ApiSecurity('session')
@ApiResponse({ status: 400, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 401, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 403, type: ProblemDetailsResponseDto })
@UseGuards(SessionGuard)
@Controller({ path: 'working-hours', version: '1' })
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @ApiOperation({ summary: 'Get my weekly working hours' })
  @ApiResponse({ status: 200, type: WorkingHoursResponseDto })
  @Get()
  get(@CurrentUser() user: SessionUser): Promise<WorkingHoursResponseDto> {
    return this.availability.get(user.userId);
  }

  @ApiOperation({
    summary: 'Replace my whole working week',
    description:
      'Professional only. Existing bookings are preserved and affected sessions are returned as warnings.',
  })
  @ApiResponse({ status: 200, type: SaveWorkingHoursResponseDto })
  @Put()
  save(
    @CurrentUser() user: SessionUser,
    @Body() dto: SaveWorkingHoursDto,
  ): Promise<SaveWorkingHoursResponseDto> {
    return this.availability.save(user.userId, dto);
  }
}
