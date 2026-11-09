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
}
