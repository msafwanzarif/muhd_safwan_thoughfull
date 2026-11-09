import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SlotResponseDto {
  @ApiProperty({ format: 'date-time' }) startAt!: string;

  @ApiProperty({ format: 'date-time' }) endAt!: string;

  @ApiProperty() available!: boolean;

  @ApiPropertyOptional({ enum: ['MEMBER_OVERLAP'] }) reason?: 'MEMBER_OVERLAP';
}

export class SlotsResponseDto {
  @ApiProperty({ format: 'uuid' }) professionalId!: string;

  @ApiProperty() professionalTimezone!: string;

  @ApiProperty() memberTimezone!: string;

  @ApiProperty({ type: [SlotResponseDto] }) slots!: SlotResponseDto[];
}
