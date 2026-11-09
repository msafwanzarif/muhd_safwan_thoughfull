import { APP_FILTER } from '@nestjs/core';
import { ProblemDetailsFilter } from '../common/filters/problem-details.filter';
import { ThrottlerModule } from '@nestjs/throttler';
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionGuard } from '../common/guards/session.guard';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }])],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionGuard,
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
