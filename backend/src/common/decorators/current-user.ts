import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface SessionUser {
  userId: string;
  role: 'member' | 'professional';
  timezone: string;
  sessionId: string;
}

export type AuthRequest = Request & { user: SessionUser };

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser =>
    context.switchToHttp().getRequest<AuthRequest>().user,
);
