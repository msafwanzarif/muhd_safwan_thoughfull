import { ApiProperty } from '@nestjs/swagger';

export class SessionParticipantDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty() name!: string;

  @ApiProperty({ example: 'Asia/Kuala_Lumpur' }) timezone!: string;
}

export class SessionResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty({ type: SessionParticipantDto }) member!: SessionParticipantDto;

  @ApiProperty({ type: SessionParticipantDto })
  professional!: SessionParticipantDto;

  @ApiProperty({ format: 'date-time' }) startAt!: string;

  @ApiProperty({ format: 'date-time' }) endAt!: string;

  @ApiProperty({ format: 'date-time' }) createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  cancelledAt!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true }) cancelledBy!:
    string | null;

  @ApiProperty({ type: String, nullable: true }) reason!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  rescheduledFromId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  rescheduledToId!: string | null;

  @ApiProperty({ enum: ['active', 'cancelled', 'rescheduled'] }) status!:
    'active' | 'cancelled' | 'rescheduled';
}

export class SessionsPageResponseDto {
  @ApiProperty({ type: [SessionResponseDto] }) items!: SessionResponseDto[];

  @ApiProperty() page!: number;

  @ApiProperty() pageSize!: number;

  @ApiProperty() total!: number;

  @ApiProperty() totalPages!: number;
}
