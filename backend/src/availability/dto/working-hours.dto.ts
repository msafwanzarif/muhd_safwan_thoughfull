import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WorkingRangeDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: 'Sunday = 0' })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty({ minimum: 0, maximum: 1425, multipleOf: 15 })
  @IsInt()
  @Min(0)
  @Max(1425)
  startMinute!: number;

  @ApiProperty({ minimum: 1, maximum: 24 })
  @IsInt()
  @Min(1)
  @Max(24)
  lengthHours!: number;
}

export class SaveWorkingHoursDto {
  @ApiProperty({
    type: [WorkingRangeDto],
    description: 'Replaces the whole week; an empty array clears it',
  })
  @IsArray()
  @ArrayMaxSize(168)
  @ValidateNested({ each: true })
  @Type(() => WorkingRangeDto)
  ranges!: WorkingRangeDto[];
}

export class AffectedSessionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty({ format: 'date-time' }) startAt!: string;

  @ApiProperty({ format: 'date-time' }) endAt!: string;
}

export class WorkingHoursResponseDto {
  @ApiProperty() timezone!: string;

  @ApiProperty({ type: [WorkingRangeDto] })
  ranges!: WorkingRangeDto[];
}

export class SaveWorkingHoursResponseDto extends WorkingHoursResponseDto {
  @ApiProperty({
    type: [AffectedSessionDto],
    description:
      'Existing future sessions outside the new hours; sessions are preserved',
  })
  warnings!: AffectedSessionDto[];
}
