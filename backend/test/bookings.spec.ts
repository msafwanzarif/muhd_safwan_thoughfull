import 'reflect-metadata';
import { it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import request from 'supertest';
import { DateTime } from 'luxon';
import {
  DatabaseModule,
  DatabaseService,
} from '../src/database/database.module';
import { AuthModule } from '../src/auth/auth.module';
import { AuthService } from '../src/auth/auth.service';
import { BookingsModule } from '../src/bookings/bookings.module';
import { BookingsService } from '../src/bookings/bookings.service';
import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { setupSwagger } from '../src/config/swagger';

it('books real slots exactly once and rejects concurrent professional/member overlaps', async () => {
  const pg = await new PostgreSqlContainer('postgres:18-alpine').start();
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            DATABASE_URL: pg.getConnectionUri(),
            FRONTEND_ORIGIN: 'https://example.test',
          }),
        ],
      }),
      DatabaseModule,
      AuthModule,
      BookingsModule,
    ],
  }).compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  try {
    const database = module.get(DatabaseService);
    await migrate(database.db, {
      migrationsFolder: resolve('backend/src/database/migrations'),
    });
    setupSwagger(app);
    await app.init();
    const api = request(app.getHttpServer());
    const auth = module.get(AuthService);
    const bookings = module.get(BookingsService);
    const credentials = {
      name: 'Test',
      password: 'a sufficiently long password',
      timezone: 'UTC',
    };
    const accounts = [];
    for (let i = 0; i < 4; i++) {
      accounts.push(
        await auth.signUp(
          {
            ...credentials,
            email: i + '@example.test',
            role: i < 2 ? 'member' : 'professional',
            ...(i >= 2
              ? {
                  title: 'Counsellor',
                  bio: 'Bio',
                  languages: ['en' as const],
                  specialisations: ['anxiety' as const],
                }
              : {}),
          },
          'booking-signup-key-' + i,
        ),
      );
    }
    const identities = accounts.map((a) => ({
      userId: a.id,
      role: a.role,
      timezone: a.timezone,
      sessionId: 'unused',
    }));
    const token = (
      await auth.login({ ...credentials, email: '0@example.test' })
    ).token;
    const start = DateTime.utc()
      .plus({ days: 1 })
      .startOf('day')
      .plus({ hours: 9 });
    for (const pro of accounts.slice(2)) {
      await database.pool.query(
        'INSERT INTO working_hours (professional_id,weekday,start_minute,length_hours,created_by,updated_by) VALUES ($1,$2,540,8,$1,$1)',
        [pro.id, start.weekday % 7],
      );
    }
    const dto = { professionalId: accounts[2].id, startAt: start.toISO()! };
    await api.post('/api/v1/sessions').send(dto).expect(401);
    await api
      .post('/api/v1/sessions')
      .set('Authorization', 'Bearer ' + token)
      .send(dto)
      .expect(400);
    await api
      .post('/api/v1/sessions')
      .set('Authorization', 'Bearer ' + token)
      .set('Idempotency-Key', 'invalid-slot-key')
      .send({ ...dto, startAt: start.plus({ minutes: 15 }).toISO() })
      .expect(409);
    const retry = () =>
      api
        .post('/api/v1/sessions')
        .set('Authorization', 'Bearer ' + token)
        .set('Idempotency-Key', 'same-booking-key-001')
        .send(dto);
    const pair = await Promise.all([retry(), retry()]);
    expect(pair.map((r) => r.status)).toEqual([201, 201]);
    expect(pair[0].body).toEqual(pair[1].body);
    const replay = await retry();
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(pair[0].body);
    await api
      .post('/api/v1/sessions')
      .set('Authorization', 'Bearer ' + token)
      .set('Idempotency-Key', 'same-booking-key-001')
      .send({ ...dto, startAt: start.plus({ hours: 1 }).toISO() })
      .expect(422);
    const conflict = await api
      .post('/api/v1/sessions')
      .set('Authorization', 'Bearer ' + token)
      .set('Idempotency-Key', 'another-booking-key')
      .send(dto)
      .expect(409);
    expect(conflict.body.code).toBe('SLOT_TAKEN');
    const raceStart = start.plus({ hours: 1 }).toISO()!;
    const race = await Promise.allSettled([
      bookings.create(
        identities[0],
        { ...dto, startAt: raceStart },
        'race-booking-key-01',
      ),
      bookings.create(
        identities[1],
        { ...dto, startAt: raceStart },
        'race-booking-key-02',
      ),
    ]);
    expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (race.find((r) => r.status === 'rejected') as PromiseRejectedResult)
        .reason.status,
    ).toBe(409);
    const memberStart = start.plus({ hours: 2 }).toISO()!;
    const memberRace = await Promise.allSettled([
      bookings.create(
        identities[0],
        { professionalId: accounts[2].id, startAt: memberStart },
        'member-race-key-001',
      ),
      bookings.create(
        identities[0],
        { professionalId: accounts[3].id, startAt: memberStart },
        'member-race-key-002',
      ),
    ]);
    expect(memberRace.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    // Same key belongs to a different member and must not replay someone else's booking.
    const scoped = await bookings.create(
      identities[1],
      {
        professionalId: accounts[3].id,
        startAt: start.plus({ hours: 3 }).toISO()!,
      },
      'same-booking-key-001',
    );
    expect(scoped.memberId).toBe(accounts[1].id);
    // Recover an abandoned claim without repeating committed work.
    const crypto = await import('node:crypto');
    const staleDto = { ...dto, startAt: start.plus({ hours: 4 }).toISO()! };
    const hash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          method: 'POST',
          path: '/api/v1/sessions',
          professionalId: staleDto.professionalId,
          startAt: staleDto.startAt,
        }),
      )
      .digest('hex');
    await database.pool.query(
      "INSERT INTO idempotency_keys (user_id,key,request_hash,updated_at) VALUES ($1,'abandoned-booking-key',$2,date_trunc('milliseconds',now()-interval '31 seconds'))",
      [accounts[0].id, hash],
    );
    expect(
      (await bookings.create(identities[0], staleDto, 'abandoned-booking-key'))
        .status,
    ).toBe('active');
    const rows = await database.pool.query(
      'SELECT count(*) FROM booking_sessions WHERE start_at=$1 AND professional_id=$2',
      [dto.startAt, dto.professionalId],
    );
    expect(rows.rows[0].count).toBe('1');
    await expect(
      module
        .get(IdempotencyService)
        .execute(accounts[0].id, 'short', 'payload', async () => ({})),
    ).rejects.toMatchObject({ status: 400 });
  } finally {
    await app.close();
    await pg.stop();
  }
});
