import { ApiProperty } from '@nestjs/swagger';

export class ProblemDetailsResponseDto {
  @ApiProperty({ example: 'about:blank' }) type!: string;

  @ApiProperty({ example: 'Bad Request' }) title!: string;

  @ApiProperty({ example: 400 }) status!: number;

  @ApiProperty({ example: 'Invalid request' }) detail!: string;

  @ApiProperty({ example: 'VALIDATION_FAILED' }) code!: string;
}
