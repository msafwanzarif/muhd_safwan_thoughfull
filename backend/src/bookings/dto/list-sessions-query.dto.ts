import { IsArray, ArrayNotEmpty, IsISO8601 } from 'class-validator';
import { Transform } from 'class-transformer';
import { Type } from 'class-transformer';
import { IsInt, Min, Max, IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListSessionsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ enum: ['active', 'cancelled', 'rescheduled'] })
  @IsOptional()
  @IsIn(['active', 'cancelled', 'rescheduled'])
  status?: 'active' | 'cancelled' | 'rescheduled';

  @ApiPropertyOptional({
    enum: ['active', 'cancelled', 'rescheduled'],
    isArray: true,
    description: 'Comma-separated or repeated; do not combine with status',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['active', 'cancelled', 'rescheduled'], { each: true })
  statuses?: ('active' | 'cancelled' | 'rescheduled')[];

  @ApiPropertyOptional({ enum: ['upcoming', 'past'] })
  @IsOptional()
  @IsIn(['upcoming', 'past'])
  period?: 'upcoming' | 'past';

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
