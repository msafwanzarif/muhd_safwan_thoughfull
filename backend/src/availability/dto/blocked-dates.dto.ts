import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { AffectedSessionDto } from './working-hours.dto';

export class SaveBlockedDateDto {
  @ApiProperty({ format: 'date' })
  @Matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
  localDate!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class BlockedDateResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty({ format: 'date' }) localDate!: string;

  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
}

export class BlockedDatesResponseDto {
  @ApiProperty() timezone!: string;

  @ApiProperty({ type: [BlockedDateResponseDto] })
  items!: BlockedDateResponseDto[];
}

export class SaveBlockedDateResponseDto extends BlockedDateResponseDto {
  @ApiProperty({ type: [AffectedSessionDto] }) warnings!: AffectedSessionDto[];
}
