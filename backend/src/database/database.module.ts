import * as schema from './schema';
import {
  Global,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly pool: Pool;
  readonly db: ReturnType<typeof drizzle<typeof schema>>;
  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    });
    this.db = drizzle(this.pool, { schema, casing: 'snake_case' });
  }
  async onApplicationShutdown() {
    await this.pool.end();
  }
}
@Global()
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
