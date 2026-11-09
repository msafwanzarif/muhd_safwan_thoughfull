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
  } finally {
    await app.close();
    await pg.stop();
  }
});
