import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, Max, IsOptional, IsUUID } from 'class-validator';

export class NotificationsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Use nextCursor from the previous page',
  })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class NotificationDataDto {
  @ApiPropertyOptional({ format: 'date-time' }) startAt?: string;

  @ApiPropertyOptional({ format: 'uuid' }) reminderId?: string;

  @ApiPropertyOptional() participantName?: string;

  @ApiPropertyOptional({ enum: ['member', 'professional'] }) cancelledByRole?:
    'member' | 'professional';

  @ApiPropertyOptional({ type: String, nullable: true }) reason?: string | null;

  @ApiPropertyOptional({ format: 'uuid' }) previousSessionId?: string;

  @ApiPropertyOptional({ format: 'date-time' }) previousStartAt?: string;
}

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty({
    enum: [
      'reminder_24h',
      'reminder_1h',
      'session_cancelled',
      'session_rescheduled',
      'session_booked',
    ],
  })
  type!:
    | 'reminder_24h'
    | 'reminder_1h'
    | 'session_cancelled'
    | 'session_rescheduled'
    | 'session_booked';

  @ApiProperty({ format: 'uuid' }) sessionId!: string;

  @ApiProperty({ type: NotificationDataDto })
  data!: NotificationDataDto;

  @ApiProperty({ type: String, format: 'date-time', nullable: true }) readAt!:
    string | null;

  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class NotificationsPageResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items!: NotificationResponseDto[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true }) nextCursor!:
    string | null;
}

export class UnreadCountResponseDto {
  @ApiProperty() count!: number;
}
