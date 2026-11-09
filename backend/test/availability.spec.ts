import { UsersModule } from '../src/users/users.module';
import { ProfessionalsModule } from '../src/professionals/professionals.module';
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
import { AuthService } from '../src/auth/auth.service';
import { AuthModule } from '../src/auth/auth.module';
import { AvailabilityModule } from '../src/availability/availability.module';
import { SlotsModule } from '../src/slots/slots.module';
import { setupSwagger } from '../src/config/swagger';

it('replaces weekly hours, preserves bookings with warnings, and protects slot privacy', async () => {
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
      AvailabilityModule,
      SlotsModule,
      ProfessionalsModule,
      UsersModule,
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
    const auth = module.get(AuthService);
    const api = request(app.getHttpServer());
    const credentials = {
      name: 'Test',
      password: 'a sufficiently long password',
      timezone: 'UTC',
    };
    const professional = await auth.signUp(
      {
        ...credentials,
        email: 'professional@example.test',
        role: 'professional',
        title: 'Counsellor',
        bio: 'A bio',
        languages: ['en'],
        specialisations: ['anxiety'],
      },
      'availability-professional-key',
    );
    const member = await auth.signUp(
      { ...credentials, email: 'member@example.test', role: 'member' },
      'availability-member-key',
    );
    const proToken = (
      await auth.login({ ...credentials, email: 'professional@example.test' })
    ).token;
    const memberToken = (
      await auth.login({ ...credentials, email: 'member@example.test' })
    ).token;
    const start = DateTime.utc()
      .plus({ days: 1 })
      .startOf('day')
      .plus({ hours: 9 });
    const ranges = [
      { weekday: start.weekday % 7, startMinute: 540, lengthHours: 2 },
    ];
    await api
      .put('/api/v1/working-hours')
      .set('Authorization', 'Bearer ' + memberToken)
      .send({ ranges })
      .expect(403);
    await api.get('/api/v1/working-hours').expect(401);
    await api
      .put('/api/v1/working-hours')
      .set('Authorization', 'Bearer ' + proToken)
      .send({ ranges })
      .expect(200);
    const saved = await api
      .get('/api/v1/working-hours')
      .set('Authorization', 'Bearer ' + proToken)
      .expect(200);
    expect(saved.body.ranges).toEqual(ranges);
    await api
      .put('/api/v1/working-hours')
      .set('Authorization', 'Bearer ' + proToken)
      .send({ ranges: [...ranges, { ...ranges[0], startMinute: 555 }] })
      .expect(400);
    expect(
      (
        await api
          .get('/api/v1/working-hours')
          .set('Authorization', 'Bearer ' + proToken)
      ).body.ranges,
    ).toEqual(ranges);
    await auth.signUp(
      {
        ...credentials,
        email: 'no-hours@example.test',
        role: 'professional',
        title: 'Coach',
        bio: 'No hours yet',
        specialisations: ['career_coaching'],
        languages: ['ms'],
      },
      'directory-no-hours-key',
    );
    await api.get('/api/v1/professionals').expect(401);
    await api
      .get('/api/v1/professionals')
      .set('Authorization', 'Bearer ' + proToken)
      .expect(403);
    const directory = await api
      .get('/api/v1/professionals?pageSize=1')
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(200);
    expect(directory.body.total).toBe(2);
    expect(directory.body.items).toHaveLength(1);
    expect(directory.body.totalPages).toBe(2);
    expect(JSON.stringify(directory.body)).not.toMatch(/email|password/);
    const filtered = await api
      .get('/api/v1/professionals?name=test&specialisation=anxiety&language=en')
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(200);
    expect(filtered.body.items.map((p: { id: string }) => p.id)).toEqual([
      professional.id,
    ]);
    expect(filtered.body.items[0].hasWorkingHours).toBe(true);
    const noHours = await api
      .get('/api/v1/professionals?language=ms')
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(200);
    expect(noHours.body.items[0].hasWorkingHours).toBe(false);
    expect(
      (
        await api
          .get('/api/v1/professionals?name=%25')
          .set('Authorization', 'Bearer ' + memberToken)
      ).body.total,
    ).toBe(0);
    for (const query of [
      'date=2027-02-30',
      'date=invalid',
      'language=invalid',
      'pageSize=101',
    ]) {
      await api
        .get('/api/v1/professionals?' + query)
        .set('Authorization', 'Bearer ' + memberToken)
        .expect(400);
    }
    const dateSearch = '/api/v1/professionals?date=' + start.toISODate();
    const onDate = await api
      .get(dateSearch)
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(200);
    expect(onDate.body.items.map((p: { id: string }) => p.id)).toEqual([
      professional.id,
    ]);
    await database.pool.query(
      "UPDATE users SET timezone='Pacific/Honolulu' WHERE id=$1",
      [member.id],
    );
    const memberDate = start.setZone('Pacific/Honolulu').toISODate();
    const acrossMidnight = await api
      .get('/api/v1/professionals?date=' + memberDate)
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(200);
    expect(acrossMidnight.body.items[0].id).toBe(professional.id);
    await database.pool.query("UPDATE users SET timezone='UTC' WHERE id=$1", [
      member.id,
    ]);
    await database.pool.query(
      'INSERT INTO blocked_dates (professional_id,local_date,created_by,updated_by) VALUES ($1,$2,$1,$1)',
      [professional.id, start.toISODate()],
    );
    expect(
      (
        await api
          .get(dateSearch)
          .set('Authorization', 'Bearer ' + memberToken)
          .expect(200)
      ).body.total,
    ).toBe(0);
    await database.pool.query(
      'DELETE FROM blocked_dates WHERE professional_id=$1',
      [professional.id],
    );
    const path = '/api/v1/professionals/' + professional.id + '/slots';
    const slots = await api
      .get(path)
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(200);
    expect(
      slots.body.slots.some(
        (s: { startAt: string }) => s.startAt === start.toISO(),
      ),
    ).toBe(true);
    await api
      .get(path)
      .set('Authorization', 'Bearer ' + proToken)
      .expect(403);
    await api
      .get('/api/v1/professionals/not-a-uuid/slots')
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(400);
    await database.pool.query(
      'INSERT INTO booking_sessions (member_id,professional_id,start_at,end_at,created_by,updated_by) VALUES ($1,$2,$3,$4,$1,$1)',
      [
        member.id,
        professional.id,
        start.toISO(),
        start.plus({ minutes: 50 }).toISO(),
      ],
    );
    const busy = await api
      .get(path)
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(200);
    expect(
      busy.body.slots.some(
        (s: { startAt: string }) => s.startAt === start.toISO(),
      ),
    ).toBe(false);
    expect(JSON.stringify(busy.body)).not.toContain(member.id);
    const cleared = await api
      .put('/api/v1/working-hours')
      .set('Authorization', 'Bearer ' + proToken)
      .send({ ranges: [] })
      .expect(200);
    expect(cleared.body.warnings).toHaveLength(1);
    expect(cleared.body.warnings[0].startAt).toBe(start.toISO());
    expect(
      (await database.pool.query('SELECT status FROM booking_sessions')).rows[0]
        .status,
    ).toBe('active');
    const empty = await api
      .get(path)
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(200);
    expect(empty.body.slots).toEqual([]);
    const blocked = await api
      .put('/api/v1/blocked-dates')
      .set('Authorization', 'Bearer ' + proToken)
      .send({ localDate: start.toISODate(), reason: 'Holiday' })
      .expect(200);
    expect(blocked.body.warnings).toHaveLength(1);
    await api
      .put('/api/v1/blocked-dates')
      .set('Authorization', 'Bearer ' + memberToken)
      .send({ localDate: start.toISODate() })
      .expect(403);
    await api
      .put('/api/v1/blocked-dates')
      .set('Authorization', 'Bearer ' + proToken)
      .send({ localDate: '2027-02-30' })
      .expect(400);
    expect(
      (
        await api
          .get('/api/v1/blocked-dates')
          .set('Authorization', 'Bearer ' + proToken)
          .expect(200)
      ).body.items,
    ).toHaveLength(1);
    await api
      .put('/api/v1/working-hours')
      .set('Authorization', 'Bearer ' + proToken)
      .send({ ranges: [{ weekday: 0, startMinute: 1080, lengthHours: 2 }] })
      .expect(200);
    const utcBefore = (
      await database.pool.query('SELECT start_at FROM booking_sessions')
    ).rows[0].start_at;
    await api
      .patch('/api/v1/users/me/timezone')
      .set('Authorization', 'Bearer ' + proToken)
      .send({ timezone: 'Asia/Kathmandu' })
      .expect(400);
    expect(
      (
        await api
          .get('/api/v1/auth/me')
          .set('Authorization', 'Bearer ' + proToken)
      ).body.timezone,
    ).toBe('UTC');
    await api
      .patch('/api/v1/users/me/timezone')
      .set('Authorization', 'Bearer ' + proToken)
      .send({
        timezone: 'Asia/Kathmandu',
        ranges: [{ weekday: 0, startMinute: 1425, lengthHours: 2 }],
      })
      .expect(400);
    const replacement = [{ weekday: 1, startMinute: 540, lengthHours: 2 }];
    const changed = await api
      .patch('/api/v1/users/me/timezone')
      .set('Authorization', 'Bearer ' + proToken)
      .send({ timezone: 'Asia/Kathmandu', ranges: replacement })
      .expect(200);
    expect(changed.body.ranges).toEqual(replacement);
    expect(
      (await database.pool.query('SELECT start_at FROM booking_sessions'))
        .rows[0].start_at,
    ).toEqual(utcBefore);
    expect(
      (
        await api
          .get('/api/v1/blocked-dates')
          .set('Authorization', 'Bearer ' + proToken)
      ).body.items[0].localDate,
    ).toBe(start.toISODate());
    expect(
      (
        await api
          .get('/api/v1/auth/me')
          .set('Authorization', 'Bearer ' + proToken)
      ).body.timezone,
    ).toBe('Asia/Kathmandu');
    await api
      .patch('/api/v1/users/me/timezone')
      .set('Authorization', 'Bearer ' + proToken)
      .send({
        timezone: 'UTC',
        ranges: [{ weekday: 1, startMinute: 540, lengthHours: 2 }],
      })
      .expect(200);
    await api
      .patch('/api/v1/users/me/timezone')
      .set('Authorization', 'Bearer ' + memberToken)
      .send({ timezone: 'Asia/Kathmandu', ranges: [] })
      .expect(400);
    await api
      .patch('/api/v1/users/me/timezone')
      .set('Authorization', 'Bearer ' + memberToken)
      .send({ timezone: 'Asia/Kathmandu' })
      .expect(200);
    expect(
      (
        await api
          .get('/api/v1/auth/me')
          .set('Authorization', 'Bearer ' + memberToken)
      ).body.timezone,
    ).toBe('Asia/Kathmandu');
    await api
      .delete('/api/v1/blocked-dates/' + blocked.body.id)
      .set('Authorization', 'Bearer ' + proToken)
      .expect(204);
  } finally {
    await app.close();
    await pg.stop();
  }
});
