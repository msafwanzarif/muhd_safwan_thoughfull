import { DatabaseModule } from './database/database.module';
import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
@Controller({ path: 'health', version: '1' })
class HealthController {
  @Get() check() {
    return { status: 'ok' };
  }
}
@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
      validate: (env) => {
        for (const key of ['DATABASE_URL', 'REDIS_HOST', 'FRONTEND_ORIGIN'])
          if (!env[key]) throw new Error(key + ' is required');
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
