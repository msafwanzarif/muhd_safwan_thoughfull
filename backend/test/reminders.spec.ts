import 'reflect-metadata';
import { it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import request from 'supertest';
import {
  DatabaseModule,
  DatabaseService,
} from '../src/database/database.module';
import { AuthModule } from '../src/auth/auth.module';
import { AuthService } from '../src/auth/auth.service';
import { RemindersModule } from '../src/reminders/reminders.module';
import { ReminderQueueService } from '../src/reminders/reminder-queue.service';
import { ReminderDeliveryService } from '../src/reminders/reminder-delivery.service';
import { createReminderRecords } from '../src/reminders/reminder-records';
import { NotificationsModule } from '../src/notifications/notifications.module';
import { setupSwagger } from '../src/config/swagger';

it('recovers pending jobs, delivers once and protects notification ownership', async () => {
  const pg = await new PostgreSqlContainer('postgres:18-alpine').start();
  const redis = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();
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
      NotificationsModule,
      BullModule.forRoot({
        connection: { host: redis.getHost(), port: redis.getMappedPort(6379) },
      }),
      RemindersModule,
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
    const db = module.get(DatabaseService);
    await migrate(db.db, {
      migrationsFolder: resolve('backend/src/database/migrations'),
    });
    const auth = module.get(AuthService),
      credentials = {
        name: 'Test',
        password: 'a sufficiently long password',
        timezone: 'UTC',
      };
    const member = await auth.signUp(
      { ...credentials, email: 'member@example.test', role: 'member' },
      'reminders-member-key',
    );
    const pro = await auth.signUp(
      {
        ...credentials,
        email: 'professional@example.test',
        role: 'professional',
        title: 'Counsellor',
        bio: 'Bio',
        languages: ['en'],
        specialisations: ['anxiety'],
      },
      'reminders-pro-key',
    );
    const makeSession = async (hours: number) => {
      const start = new Date(Date.now() + hours * 3600000);

      return (
        await db.pool.query(
          'INSERT INTO booking_sessions (member_id,professional_id,start_at,end_at,created_by,updated_by) VALUES ($1,$2,$3,$4,$1,$1) RETURNING *',
          [member.id, pro.id, start, new Date(start.getTime() + 50 * 60000)],
        )
      ).rows[0];
    };
    const session = await makeSession(48);
    await db.db.transaction((tx) =>
      createReminderRecords(tx, {
        id: session.id,
        memberId: member.id,
        professionalId: pro.id,
        startAt: session.start_at,
      }),
    );
    const pending = (await db.pool.query('SELECT * FROM reminders')).rows;
    expect(pending).toHaveLength(4);
    // Startup queues rows that existed before the process started.
    setupSwagger(app);
    await app.init();
    const queue = module.get<Queue>(getQueueToken('reminders'));
    const recovery = module.get(ReminderQueueService);
    for (const reminder of pending) {
      expect(await queue.getJob(reminder.id)).toBeTruthy();
    }
    // Simulate Redis losing delayed jobs; reconciliation must restore them.
    await queue.drain(true);
    await recovery.reconcile();
    for (const reminder of pending) {
      expect(await queue.getJob(reminder.id)).toBeTruthy();
    }
    await db.pool.query(
      "UPDATE reminders SET due_at=now()-interval '1 minute'",
    );
    await queue.drain(true);
    await recovery.reconcile();
    for (let attempt = 0; attempt < 100; attempt++) {
      const count = (
        await db.pool.query(
          "SELECT count(*) FROM reminders WHERE status='sent'",
        )
      ).rows[0].count;
      if (count === '4') {
        break;
      }
      await setTimeout(100);
    }
    expect(
      (
        await db.pool.query(
          "SELECT count(*) FROM reminders WHERE status='sent'",
        )
      ).rows[0].count,
    ).toBe('4');
    const delivery = module.get(ReminderDeliveryService);
    await Promise.all([
      delivery.deliver(pending[0].id),
      delivery.deliver(pending[0].id),
    ]);
    expect(
      (await db.pool.query('SELECT count(*) FROM notifications')).rows[0].count,
    ).toBe('4');
    const cancelled = await makeSession(72);
    const skipped = await makeSession(-2);
    const addReminder = async (id: string) =>
      (
        await db.pool.query(
          "INSERT INTO reminders (session_id,recipient_id,type,due_at) VALUES ($1,$2,'1h',now()-interval '1 minute') RETURNING id",
          [id, member.id],
        )
      ).rows[0].id;
    const cancelId = await addReminder(cancelled.id);
    await db.pool.query(
      "UPDATE booking_sessions SET status='cancelled' WHERE id=$1",
      [cancelled.id],
    );
    await delivery.deliver(cancelId);
    expect(
      (
        await db.pool.query('SELECT status FROM reminders WHERE id=$1', [
          cancelId,
        ])
      ).rows[0].status,
    ).toBe('cancelled');
    const skipId = await addReminder(skipped.id);
    await delivery.deliver(skipId);
    expect(
      (
        await db.pool.query('SELECT status FROM reminders WHERE id=$1', [
          skipId,
        ])
      ).rows[0].status,
    ).toBe('skipped');
    const future = await makeSession(96);
    const queued = (
      await db.pool.query(
        "INSERT INTO reminders (session_id,recipient_id,type,due_at) VALUES ($1,$2,'1h',now()+interval '1 hour') RETURNING id",
        [future.id, member.id],
      )
    ).rows[0].id;
    await recovery.syncSession(future.id);
    expect(await queue.getJob(queued)).toBeTruthy();
    await db.pool.query("UPDATE reminders SET status='cancelled' WHERE id=$1", [
      queued,
    ]);
    await recovery.syncSession(future.id);
    expect(await queue.getJob(queued)).toBeUndefined();
    const token = (
      await auth.login({ ...credentials, email: 'member@example.test' })
    ).token;
    const proToken = (
      await auth.login({ ...credentials, email: 'professional@example.test' })
    ).token;
    const api = request(app.getHttpServer());
    await api.get('/api/v1/notifications').expect(401);
    const list = await api
      .get('/api/v1/notifications?limit=1')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.nextCursor).toBeTruthy();
    const next = await api
      .get('/api/v1/notifications?limit=1&cursor=' + list.body.nextCursor)
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(next.body.items[0].id).not.toBe(list.body.items[0].id);
    expect(next.body.nextCursor).toBeNull();
    expect(
      (
        await api
          .get('/api/v1/notifications/unread-count')
          .set('Authorization', 'Bearer ' + token)
          .expect(200)
      ).body.count,
    ).toBe(2);
    const readPath = '/api/v1/notifications/' + list.body.items[0].id + '/read';
    await api
      .patch(readPath)
      .set('Authorization', 'Bearer ' + proToken)
      .expect(404);
    const read = await api
      .patch(readPath)
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(read.body.readAt).toBeTruthy();
    expect(
      (
        await api
          .patch(readPath)
          .set('Authorization', 'Bearer ' + token)
          .expect(200)
      ).body.readAt,
    ).toBe(read.body.readAt);
    expect(
      (
        await api
          .get('/api/v1/notifications/unread-count')
          .set('Authorization', 'Bearer ' + token)
      ).body.count,
    ).toBe(1);
    await api
      .get('/api/v1/notifications?limit=101')
      .set('Authorization', 'Bearer ' + token)
      .expect(400);
  } finally {
    await app.close();
    await redis.stop();
    await pg.stop();
  }
});
