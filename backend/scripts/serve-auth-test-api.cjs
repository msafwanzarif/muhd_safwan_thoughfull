// Isolated browser-test API: real auth, cookies and database; no demo data.
require('reflect-metadata');
const { resolve } = require('node:path');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const { Test } = require('@nestjs/testing');
const { ConfigModule } = require('@nestjs/config');
const { ValidationPipe, VersioningType } = require('@nestjs/common');
const cookieParser = require('cookie-parser');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { AuthModule } = require('../dist/auth/auth.module');
const { UsersModule } = require('../dist/users/users.module');
const {
  DatabaseModule,
  DatabaseService,
} = require('../dist/database/database.module');

async function main() {
  const pg = await new PostgreSqlContainer('postgres:18-alpine').start();
  let app;

  async function close(code = 0) {
    await app?.close();
    await pg.stop();
    process.exit(code);
  }

  process.once('SIGTERM', close);
  process.once('SIGINT', close);

  try {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              DATABASE_URL: pg.getConnectionUri(),
              FRONTEND_ORIGIN: 'http://127.0.0.1:3011',
              API_ORIGIN: 'http://127.0.0.1:3012',
            }),
          ],
        }),
        DatabaseModule,
        AuthModule,
        UsersModule,
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.enableCors({ origin: 'http://127.0.0.1:3011', credentials: true });
    await migrate(module.get(DatabaseService).db, {
      migrationsFolder: resolve(__dirname, '../src/database/migrations'),
    });
    await app.listen(3012, '127.0.0.1');
  } catch (error) {
    console.error(error);
    await close(1);
  }
}

void main();
