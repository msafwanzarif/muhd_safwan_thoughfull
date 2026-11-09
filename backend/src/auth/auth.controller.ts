import {
  SignUpResponseDto,
  LoginResponseDto,
  CurrentUserResponseDto,
} from './dto/auth-response.dto';
import { ProblemDetailsResponseDto } from '../common/dto/problem-details-response.dto';
import {
  ApiBody,
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiResponse,
  ApiSecurity,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  HttpCode,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, SignUpDto } from './dto/auth.dto';
import { SessionGuard } from '../common/guards/session.guard';
import {
  CurrentUser,
  type SessionUser,
} from '../common/decorators/current-user';

@ApiTags('Authentication')
@ApiResponse({
  status: 400,
  type: ProblemDetailsResponseDto,
  description: 'Invalid request (application/problem+json)',
})
@ApiResponse({
  status: 429,
  type: ProblemDetailsResponseDto,
  description: 'Rate limit exceeded',
})
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private checkOrigin(origin: string | undefined) {
    if (
      origin &&
      ![
        this.config.getOrThrow<string>('FRONTEND_ORIGIN'),
        this.config.get<string>('API_ORIGIN'),
      ].includes(origin)
    ) {
      throw new ForbiddenException('Invalid request origin');
    }
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @ApiOperation({
    summary: 'Create an account',
    description:
      'Retries with the same key and payload return the original 201 response for 24 hours. Use a random UUID key. Professional fields are required for professionals only.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Random unique key, 16–128 letters, digits, underscores or hyphens',
  })
  @ApiResponse({
    status: 201,
    description: 'Account created (or original response replayed)',
    type: SignUpResponseDto,
  })
  @ApiResponse({
    status: 409,
    type: ProblemDetailsResponseDto,
    description: 'Email already registered or request still in progress',
  })
  @ApiResponse({
    status: 422,
    type: ProblemDetailsResponseDto,
    description: 'Key reused with a different payload',
  })
  @ApiHeader({
    name: 'origin',
    required: false,
    description: 'Browser-managed header; leave blank in Swagger.',
  })
  @ApiBody({
    type: SignUpDto,
    examples: {
      member: {
        summary: 'Member',
        value: {
          email: 'member@example.test',
          password: 'a sufficiently long password',
          name: 'Alex',
          role: 'member',
          timezone: 'Asia/Kuala_Lumpur',
        },
      },
      professional: {
        summary: 'Professional',
        value: {
          email: 'professional@example.test',
          password: 'a sufficiently long password',
          name: 'Alex',
          role: 'professional',
          timezone: 'Asia/Kuala_Lumpur',
          title: 'Counsellor',
          bio: 'Supporting members with stress and anxiety.',
          specialisations: ['anxiety'],
          languages: ['en'],
        },
      },
    },
  })
  @Post('sign-up')
  signUp(
    @Body() dto: SignUpDto,
    @Headers('idempotency-key') key: string,
    @Headers('origin') origin?: string,
  ): Promise<SignUpResponseDto> {
    this.checkOrigin(origin);

    return this.auth.signUp(dto, key);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @ApiOperation({
    summary: 'Log in',
    description:
      'With the configured browser Origin, sets a Secure HttpOnly SameSite=Lax cookie and returns expiresAt. Swagger on the configured API_ORIGIN and native clients without Origin receive token and expiresAt. Idle expiry: 30 minutes; hard expiry: seven days.',
  })
  @ApiHeader({
    name: 'origin',
    required: false,
    description: 'Configured frontend origin for cookie login',
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    type: ProblemDetailsResponseDto,
    description: 'Invalid credentials',
  })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Headers('origin') origin?: string,
  ): Promise<LoginResponseDto> {
    this.checkOrigin(origin);
    const result = await this.auth.login(dto);
    response.setHeader('Cache-Control', 'no-store');
    if (origin === this.config.getOrThrow<string>('FRONTEND_ORIGIN')) {
      response.cookie('session', result.token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/api',
        expires: result.expiresAt,
      });

      return { expiresAt: result.expiresAt.toISOString() };
    }

    return { token: result.token, expiresAt: result.expiresAt.toISOString() };
  }

  @ApiOperation({ summary: 'Get current session identity' })
  @ApiSecurity('bearer')
  @ApiSecurity('session')
  @ApiResponse({
    status: 200,
    description: 'Current user ID, role, timezone and session ID',
    type: CurrentUserResponseDto,
  })
  @ApiResponse({
    status: 401,
    type: ProblemDetailsResponseDto,
    description: 'Invalid or expired session',
  })
  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: SessionUser): CurrentUserResponseDto {
    return user;
  }

  @ApiOperation({
    summary: 'Revoke current session',
    description: 'Cookie clients must send the configured Origin header.',
  })
  @ApiSecurity('bearer')
  @ApiSecurity('session')
  @ApiResponse({ status: 204, description: 'Session revoked' })
  @ApiResponse({
    status: 401,
    type: ProblemDetailsResponseDto,
    description: 'Invalid or expired session',
  })
  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(user.sessionId);
    response.clearCookie('session', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api',
    });
  }
}
