import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const payload =
      error instanceof HttpException ? error.getResponse() : undefined;
    const message =
      typeof payload === 'string'
        ? payload
        : payload && typeof payload === 'object' && 'message' in payload
          ? payload.message
          : undefined;
    const detail =
      status === 500
        ? 'An unexpected error occurred'
        : Array.isArray(message)
          ? message.join('; ')
          : typeof message === 'string'
            ? message
            : 'Request failed';
    const titles: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Content',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
    };
    const codes: Record<number, string> = {
      400: 'VALIDATION_FAILED',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'EMAIL_ALREADY_REGISTERED',
      422: 'IDEMPOTENCY_KEY_REUSED',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
    };
    response
      .status(status)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title: titles[status] ?? 'Request failed',
        status,
        detail,
        code:
          payload &&
          typeof payload === 'object' &&
          'code' in payload &&
          typeof payload.code === 'string'
            ? payload.code
            : (codes[status] ?? 'REQUEST_FAILED'),
      });
  }
}
