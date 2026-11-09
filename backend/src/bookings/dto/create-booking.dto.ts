import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Matches, IsISO8601 } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() professionalId!: string;

  @ApiProperty({
    format: 'date-time',
    description: 'UTC slot start ending in Z',
    example: '2027-01-04T09:00:00.000Z',
  })
  @IsISO8601({ strict: true })
  @Matches(/Z$/)
  startAt!: string;
}
