import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Length,
  IsIn,
  IsTimeZone,
  ValidateIf,
  IsArray,
  ArrayUnique,
  MaxLength,
} from 'class-validator';
import {
  languageCodes,
  specialisationCodes,
  type LanguageCode,
  type SpecialisationCode,
} from '../../database/schema';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  @ApiProperty({ format: 'email', example: 'member@example.test' })
  email!: string;

  @ApiProperty({
    minLength: 15,
    maxLength: 128,
    writeOnly: true,
    format: 'password',
  })
  @IsString()
  @Length(15, 128)
  password!: string;
}

export class SignUpDto extends LoginDto {
  @ApiProperty({ maxLength: 100, example: 'Alex' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({ enum: ['member', 'professional'] })
  @IsIn(['member', 'professional'])
  role!: 'member' | 'professional';

  @ApiProperty({ example: 'Asia/Kuala_Lumpur' })
  @IsTimeZone()
  timezone!: string;

  @ValidateIf((o) => o.role === 'professional' || o.title !== undefined)
  @IsString()
  @Length(1, 100)
  @ApiPropertyOptional({ maxLength: 100 })
  title?: string;

  @ValidateIf((o) => o.role === 'professional' || o.bio !== undefined)
  @IsString()
  @Length(1, 2000)
  @ApiPropertyOptional({ maxLength: 2000 })
  bio?: string;

  @ValidateIf(
    (o) => o.role === 'professional' || o.specialisations !== undefined,
  )
  @IsArray()
  @ArrayUnique()
  @IsIn(specialisationCodes, { each: true })
  @ApiPropertyOptional({ enum: specialisationCodes, isArray: true })
  specialisations?: SpecialisationCode[];

  @ValidateIf((o) => o.role === 'professional' || o.languages !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsIn(languageCodes, { each: true })
  @ApiPropertyOptional({ enum: languageCodes, isArray: true })
  languages?: LanguageCode[];
}
