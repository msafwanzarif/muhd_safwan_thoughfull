import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
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
import { SlotsService } from './slots.service';
import { SlotsResponseDto } from './dto/slots-response.dto';

@ApiTags('Slots')
@ApiSecurity('bearer')
@ApiSecurity('session')
@ApiResponse({ status: 400, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 401, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 403, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 404, type: ProblemDetailsResponseDto })
@UseGuards(SessionGuard)
@Controller({ path: 'professionals/:professionalId/slots', version: '1' })
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  @ApiOperation({
    summary: 'Get virtual slots for a professional',
    description:
      'Member only. From two hours ahead through the end of today + 28 days in the member timezone. Professional-busy slots are omitted; own overlapping sessions are marked unavailable.',
  })
  @ApiResponse({ status: 200, type: SlotsResponseDto })
  @Get()
  list(
    @Param('professionalId', new ParseUUIDPipe()) professionalId: string,
    @CurrentUser() member: SessionUser,
  ): Promise<SlotsResponseDto> {
    return this.slots.list(professionalId, member);
  }
}
