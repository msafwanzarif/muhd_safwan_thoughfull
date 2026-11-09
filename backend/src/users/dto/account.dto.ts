import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  Length,
  IsOptional,
  IsArray,
  ArrayUnique,
  IsIn,
} from 'class-validator';
import {
  specialisationCodes,
  languageCodes,
  type SpecialisationCode,
  type LanguageCode,
} from '../../database/schema';

export class UpdateAccountDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  title?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  bio?: string;

  @ApiPropertyOptional({ enum: specialisationCodes, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(specialisationCodes, { each: true })
  specialisations?: SpecialisationCode[];

  @ApiPropertyOptional({ enum: languageCodes, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(languageCodes, { each: true })
  languages?: LanguageCode[];
}

export class AccountResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty() name!: string;

  @ApiProperty({ enum: ['member', 'professional'] }) role!:
    'member' | 'professional';

  @ApiProperty() timezone!: string;

  @ApiProperty({ type: String, nullable: true }) title!: string | null;

  @ApiProperty({ type: String, nullable: true }) bio!: string | null;

  @ApiProperty({ enum: specialisationCodes, isArray: true })
  specialisations!: SpecialisationCode[];

  @ApiProperty({ enum: languageCodes, isArray: true })
  languages!: LanguageCode[];
}
