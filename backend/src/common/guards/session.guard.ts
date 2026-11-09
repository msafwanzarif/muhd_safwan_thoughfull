import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../auth/auth.service';
import { AuthRequest } from '../decorators/current-user';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const authorization = request.headers.authorization;
    const bearer = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if (authorization && !bearer) {
      throw new UnauthorizedException('Invalid authorization header');
    }
    const cookie = request.cookies?.session as unknown;
    const token = bearer ?? (typeof cookie === 'string' ? cookie : undefined);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new UnauthorizedException();
    }
    if (
      !bearer &&
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      request.headers.origin !==
        this.config.getOrThrow<string>('FRONTEND_ORIGIN')
    ) {
      throw new ForbiddenException('Invalid request origin');
    }
    request.user = await this.auth.authenticate(token);

    return true;
  }
}
