import { ApiProperty } from '@nestjs/swagger';

export class BookingResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty({ format: 'uuid' }) memberId!: string;

  @ApiProperty({ format: 'uuid' }) professionalId!: string;

  @ApiProperty({ format: 'date-time' }) startAt!: string;

  @ApiProperty({ format: 'date-time' }) endAt!: string;

  @ApiProperty({ enum: ['active'] }) status!: 'active';
}
