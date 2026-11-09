import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  IsISO8601,
  Matches,
} from 'class-validator';
import { BookingResponseDto } from './booking-response.dto';

export class CancelSessionDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class RescheduleSessionDto {
  @ApiProperty({
    format: 'date-time',
    description: 'New UTC slot start; same professional',
  })
  @IsISO8601({ strict: true })
  @Matches(/Z$/)
  startAt!: string;
}

export class CancelSessionResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty({ enum: ['cancelled'] }) status!: 'cancelled';

  @ApiProperty({ format: 'uuid' }) cancelledBy!: string;

  @ApiProperty({ format: 'date-time' }) cancelledAt!: string;

  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
}

export class RescheduleSessionResponseDto {
  @ApiProperty({ format: 'uuid' }) previousSessionId!: string;

  @ApiProperty({ type: BookingResponseDto }) session!: BookingResponseDto;
}
