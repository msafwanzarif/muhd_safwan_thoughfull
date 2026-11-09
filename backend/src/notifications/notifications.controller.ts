import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
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
import { NotificationsService } from './notifications.service';
import {
  NotificationsQueryDto,
  NotificationsPageResponseDto,
  NotificationResponseDto,
  UnreadCountResponseDto,
} from './dto/notifications.dto';

@ApiTags('Notifications')
@ApiSecurity('bearer')
@ApiSecurity('session')
@UseGuards(SessionGuard)
@ApiResponse({ status: 400, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 401, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 403, type: ProblemDetailsResponseDto })
@ApiResponse({ status: 404, type: ProblemDetailsResponseDto })
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @ApiOperation({
    summary: 'List my notifications',
    description:
      'Newest UUID v7 first. Poll for updates; pass nextCursor for older pages.',
  })
  @ApiResponse({ status: 200, type: NotificationsPageResponseDto })
  @Get()
  list(
    @CurrentUser() user: SessionUser,
    @Query() query: NotificationsQueryDto,
  ): Promise<NotificationsPageResponseDto> {
    return this.notifications.list(user.userId, query);
  }

  @ApiOperation({ summary: 'Count my unread notifications' })
  @ApiResponse({ status: 200, type: UnreadCountResponseDto })
  @Get('unread-count')
  unread(@CurrentUser() user: SessionUser): Promise<UnreadCountResponseDto> {
    return this.notifications.unread(user.userId);
  }

  @ApiOperation({
    summary: 'Mark my notification as read',
    description: 'Repeated requests preserve the first read timestamp.',
  })
  @ApiResponse({ status: 200, type: NotificationResponseDto })
  @Patch(':id/read')
  markRead(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<NotificationResponseDto> {
    return this.notifications.markRead(user.userId, id);
  }
}
