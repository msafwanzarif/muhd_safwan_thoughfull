import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
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
import { UsersService } from './users.service';
import { ChangeTimezoneDto, TimezoneResponseDto } from './dto/timezone.dto';

@ApiTags('Users')
@ApiSecurity('bearer')
@ApiSecurity('session')
@UseGuards(SessionGuard)
@ApiResponse({ status: 400, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 401, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 403, type: ProblemDetailsResponseDto })
@Controller({ path: 'users/me', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @ApiOperation({
    summary: 'Change my timezone',
    description:
      'Professionals must provide their complete replacement working week in the new timezone. Ranges use whole-hour lengths and cannot cross midnight. Members omit ranges. UTC sessions and blocked calendar dates remain unchanged.',
  })
  @ApiResponse({ status: 200, type: TimezoneResponseDto })
  @Patch('timezone')
  timezone(
    @CurrentUser() user: SessionUser,
    @Body() dto: ChangeTimezoneDto,
  ): Promise<TimezoneResponseDto> {
    return this.users.timezone(user.userId, dto);
  }
}
