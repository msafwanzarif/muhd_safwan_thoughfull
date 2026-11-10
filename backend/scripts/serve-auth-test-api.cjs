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
  ProfessionalsModule,
} = require('../dist/professionals/professionals.module');
const { AuthService } = require('../dist/auth/auth.service');
const { workingHours } = require('../dist/database/schema');
const { SlotsModule } = require('../dist/slots/slots.module');
const { BookingsModule } = require('../dist/bookings/bookings.module');
const {
  NotificationsModule,
} = require('../dist/notifications/notifications.module');
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
        ProfessionalsModule,
        SlotsModule,
        BookingsModule,
        NotificationsModule,
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
    const auth = module.get(AuthService);
    for (let index = 1; index <= 14; index++) {
      const professional = await auth.signUp(
        {
          name: `Directory Example ${String(index).padStart(2, '0')}`,
          email: `directory-${index}@example.test`,
          password: 'Fictional-directory-test-2026!',
          role: 'professional',
          timezone: 'Asia/Kuala_Lumpur',
          title: 'Counsellor',
          bio: 'Fictional profile for directory browser testing.',
          specialisations: index % 2 ? ['anxiety'] : ['relationships'],
          languages: index % 2 ? ['en', 'ms'] : ['en'],
        },
        `directory-test-seed-${index}`,
      );
      if (index !== 2) {
        await module
          .get(DatabaseService)
          .db.insert(workingHours)
          .values(
            Array.from({ length: 7 }, (_, weekday) => ({
              professionalId: professional.id,
              weekday,
              startMinute: 540,
              lengthHours: 8,
              createdBy: professional.id,
              updatedBy: professional.id,
            })),
          );
      }
    }
    await app.listen(3012, '127.0.0.1');
  } catch (error) {
    console.error(error);
    await close(1);
  }
}

void main();
