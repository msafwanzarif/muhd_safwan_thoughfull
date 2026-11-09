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
    const proToken = (
      await auth.login({ ...credentials, email: '2@example.test' })
    ).token;
    const otherToken = (
      await auth.login({ ...credentials, email: '1@example.test' })
    ).token;
    const unrelatedProToken = (
      await auth.login({ ...credentials, email: '3@example.test' })
    ).token;
    await api.get('/api/v1/sessions').expect(401);
    const mySessions = await api
      .get('/api/v1/sessions?page=1&pageSize=1')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(mySessions.body.items).toHaveLength(1);
    expect(mySessions.body.total).toBeGreaterThan(1);
    expect(mySessions.body.totalPages).toBe(mySessions.body.total);
    expect(mySessions.body.items[0].member.id).toBe(accounts[0].id);
    expect(JSON.stringify(mySessions.body)).not.toMatch(
      /email|password|tokenHash/,
    );
    const ownPath = '/api/v1/sessions/' + pair[0].body.id;
    const detail = await api
      .get(ownPath)
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(detail.body.member.name).toBe('Test');
    await api
      .get(ownPath)
      .set('Authorization', 'Bearer ' + proToken)
      .expect(200);
    const stranger = await api
      .get(ownPath)
      .set('Authorization', 'Bearer ' + otherToken)
      .expect(404);
    await api
      .get(ownPath)
      .set('Authorization', 'Bearer ' + unrelatedProToken)
      .expect(404);
    const missing = await api
      .get('/api/v1/sessions/00000000-0000-4000-8000-000000000000')
      .set('Authorization', 'Bearer ' + token)
      .expect(404);
    expect(stranger.body).toEqual(missing.body);
    const professionalList = await api
      .get('/api/v1/sessions')
      .set('Authorization', 'Bearer ' + proToken)
      .expect(200);
    expect(
      professionalList.body.items.every(
        (item: { professional: { id: string } }) =>
          item.professional.id === accounts[2].id,
      ),
    ).toBe(true);
    expect(JSON.stringify(professionalList.body)).not.toContain('email');
    await api
      .get('/api/v1/sessions?memberId=' + accounts[1].id)
      .set('Authorization', 'Bearer ' + token)
      .expect(400);
    for (const query of ['page=0', 'pageSize=101', 'status=invalid']) {
      await api
        .get('/api/v1/sessions?' + query)
        .set('Authorization', 'Bearer ' + token)
        .expect(400);
    }
    await api
      .get('/api/v1/sessions/not-a-uuid')
      .set('Authorization', 'Bearer ' + token)
      .expect(400);
    expect(
      (
        await api
          .get('/api/v1/sessions?page=100')
          .set('Authorization', 'Bearer ' + token)
          .expect(200)
      ).body.items,
    ).toEqual([]);
    await database.pool.query(
      "UPDATE booking_sessions SET status='cancelled' WHERE id=$1",
      [pair[0].body.id],
    );
    const cancelled = await api
      .get('/api/v1/sessions?status=cancelled')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(cancelled.body.total).toBe(1);
    expect(cancelled.body.items[0].id).toBe(pair[0].body.id);
    // Step 7: cancellation, reschedule atomicity and participant rules.
    const future = start.plus({ days: 3 });
    await database.pool.query(
      'INSERT INTO working_hours (professional_id,weekday,start_minute,length_hours,created_by,updated_by) VALUES ($1,$2,540,8,$1,$1)',
      [accounts[2].id, future.weekday % 7],
    );
    const original = await bookings.create(
      identities[0],
      { professionalId: accounts[2].id, startAt: future.toISO()! },
      'reschedule-original-key',
    );
    const reschedulePath = '/api/v1/sessions/' + original.id + '/reschedule';
    const failed = await api
      .post(reschedulePath)
      .set('Authorization', 'Bearer ' + token)
      .set('Idempotency-Key', 'reschedule-invalid-key')
      .send({ startAt: future.plus({ minutes: 15 }).toISO() })
      .expect(409);
    expect(failed.body.code).toBe('SLOT_TAKEN');
    expect(
      (
        await database.pool.query(
          'SELECT status FROM booking_sessions WHERE id=$1',
          [original.id],
        )
      ).rows[0].status,
    ).toBe('active');
    await api
      .post(reschedulePath)
      .set('Authorization', 'Bearer ' + otherToken)
      .set('Idempotency-Key', 'reschedule-stranger-key')
      .send({ startAt: future.plus({ hours: 1 }).toISO() })
      .expect(404);
    const move = () =>
      api
        .post(reschedulePath)
        .set('Authorization', 'Bearer ' + token)
        .set('Idempotency-Key', 'reschedule-success-key')
        .send({ startAt: future.plus({ hours: 1 }).toISO() });
    const moved = await move().expect(200);
    expect((await move().expect(200)).body).toEqual(moved.body);
    expect(
      (
        await database.pool.query(
          'SELECT status FROM booking_sessions WHERE id=$1',
          [original.id],
        )
      ).rows[0].status,
    ).toBe('rescheduled');
    expect(
      (
        await database.pool.query(
          'SELECT rescheduled_from_id FROM booking_sessions WHERE id=$1',
          [moved.body.session.id],
        )
      ).rows[0].rescheduled_from_id,
    ).toBe(original.id);
    // A rescheduled range is free again.
    await bookings.create(
      identities[1],
      { professionalId: accounts[2].id, startAt: future.toISO()! },
      'freed-original-slot-key',
    );
    const cancelPath = '/api/v1/sessions/' + moved.body.session.id + '/cancel';
    await api
      .post(cancelPath)
      .set('Authorization', 'Bearer ' + otherToken)
      .set('Idempotency-Key', 'cancel-stranger-key')
      .send({})
      .expect(404);
    const cancel = () =>
      api
        .post(cancelPath)
        .set('Authorization', 'Bearer ' + token)
        .set('Idempotency-Key', 'cancel-success-key')
        .send({ reason: 'Plans changed' });
    const cancelledResult = await cancel().expect(200);
    expect(cancelledResult.body.status).toBe('cancelled');
    expect((await cancel().expect(200)).body).toEqual(cancelledResult.body);
    expect(cancelledResult.body.reason).toBe('Plans changed');
    const nearStart = DateTime.utc().plus({ hours: 1 });
    const near = (
      await database.pool.query(
        'INSERT INTO booking_sessions (member_id,professional_id,start_at,end_at,created_by,updated_by) VALUES ($1,$2,$3,$4,$1,$1) RETURNING id',
        [
          accounts[0].id,
          accounts[3].id,
          nearStart.toISO(),
          nearStart.plus({ minutes: 50 }).toISO(),
        ],
      )
    ).rows[0].id;
    const nearPath = '/api/v1/sessions/' + near + '/cancel';
    const blocked = await api
      .post(nearPath)
      .set('Authorization', 'Bearer ' + token)
      .set('Idempotency-Key', 'cancel-under-24h-key')
      .send({})
      .expect(403);
    expect(blocked.body.code).toBe('WITHIN_24_HOURS');
    await api
      .post('/api/v1/sessions/' + near + '/reschedule')
      .set('Authorization', 'Bearer ' + token)
      .set('Idempotency-Key', 'reschedule-under24-key')
      .send({ startAt: future.toISO() })
      .expect(403);
    await api
      .post(nearPath)
      .set('Authorization', 'Bearer ' + unrelatedProToken)
      .set('Idempotency-Key', 'professional-cancel-key')
      .send({})
      .expect(200);
    expect(
      (
        await database.pool.query(
          "SELECT count(*) FROM notifications WHERE type='session_cancelled'",
        )
      ).rows[0].count,
    ).toBe('2');
    expect(
      (
        await database.pool.query(
          "SELECT count(*) FROM notifications WHERE type='session_rescheduled'",
        )
      ).rows[0].count,
    ).toBe('1');
    const originalReminders = (
      await database.pool.query(
        'SELECT status FROM reminders WHERE session_id=$1',
        [original.id],
      )
    ).rows;
    expect(originalReminders).toHaveLength(4);
    expect(
      originalReminders.every(
        (r: { status: string }) => r.status === 'cancelled',
      ),
    ).toBe(true);
    const movedReminders = (
      await database.pool.query(
        'SELECT status FROM reminders WHERE session_id=$1',
        [moved.body.session.id],
      )
    ).rows;
    expect(movedReminders).toHaveLength(4);
    expect(
      movedReminders.every((r: { status: string }) => r.status === 'cancelled'),
    ).toBe(true);
    const upcoming = await api
      .get(
        '/api/v1/sessions?period=upcoming&statuses=active,cancelled,rescheduled',
      )
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(
      upcoming.body.items.every(
        (item: { endAt: string }) => Date.parse(item.endAt) > Date.now(),
      ),
    ).toBe(true);
    const history = await api
      .get('/api/v1/sessions/' + original.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(history.body.rescheduledToId).toBe(moved.body.session.id);
    expect(history.body.createdAt).toBeTruthy();
    const cancelledDetail = await api
      .get('/api/v1/sessions/' + moved.body.session.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(cancelledDetail.body.reason).toBe('Plans changed');
    expect(cancelledDetail.body.cancelledBy).toBe(accounts[0].id);
    const bounded = await api
      .get(
        '/api/v1/sessions?from=' +
          encodeURIComponent(future.toISO()!) +
          '&to=' +
          encodeURIComponent(future.plus({ hours: 1 }).toISO()!),
      )
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(
      bounded.body.items.every(
        (item: { startAt: string }) =>
          Date.parse(item.startAt) >= future.toMillis() &&
          Date.parse(item.startAt) < future.plus({ hours: 1 }).toMillis(),
      ),
    ).toBe(true);
    await api
      .get('/api/v1/sessions?status=active&statuses=cancelled')
      .set('Authorization', 'Bearer ' + token)
      .expect(400);
  } finally {
    await app.close();
    await pg.stop();
  }
});
