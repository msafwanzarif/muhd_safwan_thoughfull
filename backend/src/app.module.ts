import { AvailabilityModule } from './availability/availability.module';
import { SlotsModule } from './slots/slots.module';
import { ApiResponse } from '@nestjs/swagger';
import { HealthResponseDto } from './common/dto/health-response.dto';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

@Controller({ path: 'health', version: '1' })
class HealthController {
  @ApiResponse({ status: 200, type: HealthResponseDto })
  @Get()
  check(): HealthResponseDto {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AvailabilityModule,
    SlotsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
      validate: (env) => {
        for (const key of ['DATABASE_URL', 'REDIS_HOST', 'FRONTEND_ORIGIN']) {
          if (!env[key]) {
            throw new Error(key + ' is required');
          }
        }

        return env;
      },
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
      },
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
