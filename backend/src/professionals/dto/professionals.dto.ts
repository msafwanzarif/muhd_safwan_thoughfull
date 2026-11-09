import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  IsIn,
  Matches,
} from 'class-validator';
import {
  specialisationCodes,
  languageCodes,
  type SpecialisationCode,
  type LanguageCode,
} from '../../database/schema';

export class ProfessionalsQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: specialisationCodes })
  @IsOptional()
  @IsIn(specialisationCodes)
  specialisation?: SpecialisationCode;

  @ApiPropertyOptional({ enum: languageCodes })
  @IsOptional()
  @IsIn(languageCodes)
  language?: LanguageCode;

  @ApiPropertyOptional({
    format: 'date',
    description:
      'Has a free slot starting on this date in the member timezone, within the booking window',
  })
  @IsOptional()
  @Matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
  date?: string;
}

export class ProfessionalResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty() name!: string;

  @ApiProperty() timezone!: string;

  @ApiProperty({ type: String, nullable: true }) title!: string | null;

  @ApiProperty({ type: String, nullable: true }) bio!: string | null;

  @ApiProperty({ enum: specialisationCodes, isArray: true })
  specialisations!: SpecialisationCode[];

  @ApiProperty({ enum: languageCodes, isArray: true })
  languages!: LanguageCode[];

  @ApiProperty({
    description:
      'False means no availability; true means hours are configured, not a guarantee of a free slot',
  })
  hasWorkingHours!: boolean;
}

export class ProfessionalsPageResponseDto {
  @ApiProperty({ type: [ProfessionalResponseDto] })
  items!: ProfessionalResponseDto[];

  @ApiProperty() page!: number;

  @ApiProperty() pageSize!: number;

  @ApiProperty() total!: number;

  @ApiProperty() totalPages!: number;
}
