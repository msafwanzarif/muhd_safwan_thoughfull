import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsTimeZone,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  WorkingRangeDto,
  AffectedSessionDto,
} from '../../availability/dto/working-hours.dto';

export class ChangeTimezoneDto {
  @ApiProperty({ example: 'Asia/Kuala_Lumpur' })
  @IsTimeZone()
  timezone!: string;

  @ApiPropertyOptional({
    type: [WorkingRangeDto],
    description:
      'Required for professionals: complete replacement week in the new timezone. An empty array clears hours. Omit for members.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(168)
  @ValidateNested({ each: true })
  @Type(() => WorkingRangeDto)
  ranges?: WorkingRangeDto[];
}

export class TimezoneResponseDto {
  @ApiProperty() timezone!: string;

  @ApiProperty({ type: [WorkingRangeDto] })
  ranges!: WorkingRangeDto[];

  @ApiProperty({ type: [AffectedSessionDto] }) warnings!: AffectedSessionDto[];
}
