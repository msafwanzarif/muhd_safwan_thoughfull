import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignUpResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty({ enum: ['member', 'professional'] }) role!:
    'member' | 'professional';

  @ApiProperty({ example: 'Asia/Kuala_Lumpur' }) timezone!: string;
}

export class LoginResponseDto {
  @ApiPropertyOptional({
    description:
      'Returned to Swagger and native clients; omitted for frontend cookie login',
  })
  token?: string;

  @ApiProperty({ type: String, format: 'date-time' }) expiresAt!: string;
}

export class CurrentUserResponseDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;

  @ApiProperty({ enum: ['member', 'professional'] }) role!:
    'member' | 'professional';

  @ApiProperty({ example: 'Asia/Kuala_Lumpur' }) timezone!: string;

  @ApiProperty({ format: 'uuid' }) sessionId!: string;
}
