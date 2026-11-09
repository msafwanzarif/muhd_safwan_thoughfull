import { AuthService } from '../src/auth/auth.service';
import { setupSwagger } from '../src/config/swagger';
import 'reflect-metadata';
import { it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { AuthModule } from '../src/auth/auth.module';
import {
  DatabaseModule,
  DatabaseService,
} from '../src/database/database.module';

it('validates sign-up and authenticates, expires and revokes opaque sessions', async () => {
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
            API_ORIGIN: 'http://localhost:3000',
          }),
        ],
      }),
      DatabaseModule,
      AuthModule,
    ],
  }).compile();
  const app = module.createNestApplication();
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
  try {
    const database = module.get(DatabaseService);
    await migrate(database.db, {
      migrationsFolder: resolve('backend/src/database/migrations'),
    });
    const document = setupSwagger(app);
    expect(document.paths['/api/v1/auth/sign-up'].post?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Idempotency-Key', required: true }),
      ]),
    );
    expect(document.paths['/api/v1/auth/sign-up'].post?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'origin', required: false }),
      ]),
    );
    await app.init();
    const api = request(app.getHttpServer());
    await api.get('/api/openapi.json').expect(200);
    const auth = module.get(AuthService);
    const retryBody = {
      name: 'Retry',
      email: 'retry@example.test',
      password: 'a sufficiently long password',
      role: 'member' as const,
      timezone: 'UTC',
    };
    const retries = await Promise.all([
      auth.signUp(retryBody, 'concurrent-signup-key'),
      auth.signUp(retryBody, 'concurrent-signup-key'),
    ]);
    expect(retries[0]).toEqual(retries[1]);
    expect(await auth.signUp(retryBody, 'concurrent-signup-key')).toEqual(
      retries[0],
    );
    await expect(
      auth.signUp({ ...retryBody, name: 'Changed' }, 'concurrent-signup-key'),
    ).rejects.toMatchObject({ status: 422 });
    await expect(auth.signUp(retryBody, '')).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      auth.signUp(retryBody, 'different-signup-key'),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await database.pool.query(
          "SELECT count(*) FROM users WHERE email='retry@example.test'",
        )
      ).rows[0].count,
    ).toBe('1');
    const saved = (
      await database.pool.query(
        'SELECT request_hash FROM signup_idempotency_keys',
      )
    ).rows[0].request_hash;
    expect(saved).toMatch(/^\$argon2id\$/);

    const body = {
      name: 'Member',
      email: 'MEMBER@example.test',
      password: 'a sufficiently long password',
      role: 'member',
      timezone: 'Asia/Kuala_Lumpur',
    };
    await api
      .post('/api/v1/auth/sign-up')
      .set('Idempotency-Key', 'signup-test-key-1')
      .send({ ...body, timezone: 'invalid' })
      .expect(400);
    const signup = await api
      .post('/api/v1/auth/sign-up')
      .set('Idempotency-Key', 'signup-test-key-2')
      .send(body)
      .expect(201);
    expect(signup.body).not.toHaveProperty('passwordHash');
    await api
      .post('/api/v1/auth/sign-up')
      .set('Idempotency-Key', 'signup-test-key-3')
      .send({
        ...body,
        email: 'professional@example.test',
        role: 'professional',
        title: 'Counsellor',
        bio: 'Professional bio',
        specialisations: ['anxiety'],
        languages: ['en'],
      })
      .expect(201);
    expect(
      (await database.pool.query('SELECT count(*) FROM professional_profiles'))
        .rows[0].count,
    ).toBe('1');
    await api
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: 'incorrect long password' })
      .expect(401);
    const login = await api
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send(bodyFields(body))
      .expect(200);
    const token = login.body.token;
    expect(token).toHaveLength(43);
    const stored = (
      await database.pool.query('SELECT token_hash FROM user_sessions')
    ).rows[0].token_hash;
    expect(stored).not.toBe(token);
    expect(stored).toHaveLength(64);
    await api
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    await database.pool.query("UPDATE users SET timezone='UTC'");
    const me = await api
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(me.body.timezone).toBe('UTC');
    expect(me.body).not.toHaveProperty('email');
    await api
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer ' + token)
      .expect(204);
    await api
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer ' + token)
      .expect(401);
    const web = await api
      .post('/api/v1/auth/login')
      .set('Origin', 'https://example.test')
      .send(bodyFields(body))
      .expect(200);
    expect(web.body).not.toHaveProperty('token');
    const cookie = web.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    await api
      .get('/api/v1/auth/me')
      .set('Cookie', cookie.split(';')[0])
      .expect(200);
    await database.pool.query(
      "UPDATE user_sessions SET last_active_at=now()-interval '31 minutes'",
    );
    await api
      .get('/api/v1/auth/me')
      .set('Cookie', cookie.split(';')[0])
      .expect(401);
    const hard = await api
      .post('/api/v1/auth/login')
      .send(bodyFields(body))
      .expect(200);
    await database.pool.query(
      "UPDATE user_sessions SET expires_at=now()-interval '1 second'",
    );
    await api
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer ' + hard.body.token)
      .expect(401);
    await api.post('/api/v1/auth/login').send(bodyFields(body)).expect(200);
    await api.post('/api/v1/auth/login').send(bodyFields(body)).expect(429);
  } finally {
    await app.close();
    await pg.stop();
  }
});
function bodyFields(body: { email: string; password: string }) {
  return { email: body.email, password: body.password };
}
