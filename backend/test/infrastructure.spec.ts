import { it, expect } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';
import { Pool } from 'pg';

it('runs PostgreSQL 18 and Redis', async () => {
  const pg = await new PostgreSqlContainer('postgres:18-alpine').start();
  try {
    const pool = new Pool({ connectionString: pg.getConnectionUri() });
    try {
      expect((await pool.query('select uuidv7() id')).rows[0].id).toBeTruthy();
    } finally {
      await pool.end();
    }
    const redis = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();
    try {
      expect((await redis.exec(['redis-cli', 'ping'])).output.trim()).toBe(
        'PONG',
      );
    } finally {
      await redis.stop();
    }
  } finally {
    await pg.stop();
  }
});
