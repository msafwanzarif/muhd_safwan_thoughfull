import { Param, ParseUUIDPipe } from '@nestjs/common';
import { ProfessionalResponseDto } from './dto/professionals.dto';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import { ProfessionalsService } from './professionals.service';
import {
  ProfessionalsQueryDto,
  ProfessionalsPageResponseDto,
} from './dto/professionals.dto';

@ApiTags('Professionals')
@ApiSecurity('bearer')
@ApiSecurity('session')
@UseGuards(SessionGuard)
@ApiResponse({ status: 400, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 401, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 403, type: ProblemDetailsResponseDto })
@Controller({ path: 'professionals', version: '1' })
export class ProfessionalsController {
  constructor(private readonly professionals: ProfessionalsService) {}

  @ApiOperation({
    summary: 'Browse professionals',
    description:
      'Member only. Filter by name, specialisation, language or free-slot date in your timezone. Professionals without hours remain listed unless a free-slot date is requested. Emails are excluded.',
  })
  @ApiResponse({ status: 200, type: ProfessionalsPageResponseDto })
  @Get()
  list(
    @CurrentUser() member: SessionUser,
    @Query() query: ProfessionalsQueryDto,
  ): Promise<ProfessionalsPageResponseDto> {
    return this.professionals.list(member, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a public professional profile' })
  @ApiResponse({ status: 200, type: ProfessionalResponseDto })
  @ApiResponse({ status: 404, type: ProblemDetailsResponseDto })
  get(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProfessionalResponseDto> {
    return this.professionals.get(user, id);
  }
}
