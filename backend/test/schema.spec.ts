import { it, expect } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
it('migrates cleanly and enforces booking and working-hours exclusions', async () => {
  const container = await new PostgreSqlContainer('postgres:18-alpine').start();
  const pool = new Pool({ connectionString: container.getConnectionUri() });
  try {
    const db = drizzle(pool);
    const options = {
      migrationsFolder: resolve('backend/src/database/migrations'),
    };
    await migrate(db, options);
    await migrate(db, options);
    const ids = [];
    for (let i = 0; i < 4; i++) {
      const result = await pool.query(
        "INSERT INTO users (name,email,password_hash,role,timezone) VALUES ('Test', $1, 'hash', $2, 'UTC') RETURNING id",
        [i + '@example.test', i < 2 ? 'member' : 'professional'],
      );
      ids.push(result.rows[0].id);
    }
    await pool.query(
      'INSERT INTO professional_profiles (user_id, specialisations, languages) VALUES ($1, $2, $3)',
      [ids[2], JSON.stringify(['anxiety']), JSON.stringify(['en', 'ms'])],
    );
    await expect(
      pool.query(
        'UPDATE professional_profiles SET languages = $1 WHERE user_id = $2',
        [JSON.stringify(['invalid']), ids[2]],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query(
        'UPDATE professional_profiles SET specialisations = $1 WHERE user_id = $2',
        [JSON.stringify({ anxiety: true }), ids[2]],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    const book = (member: string, professional: string, start: string) =>
      pool.query(
        "INSERT INTO booking_sessions (member_id,professional_id,start_at,end_at,created_by,updated_by) VALUES ($1,$2,$3::timestamptz,$3::timestamptz + interval '50 minutes',$1,$1) RETURNING id",
        [member, professional, start],
      );
    const results = await Promise.allSettled([
      book(ids[0], ids[2], '2027-01-01T10:00:00Z'),
      book(ids[1], ids[2], '2027-01-01T10:00:00Z'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult;
    // Concurrent GiST exclusion checks can reject with a deadlock instead.
    expect(['23P01', '40P01']).toContain(failure.reason.code);
    const member = (await pool.query('SELECT member_id FROM booking_sessions'))
      .rows[0].member_id;
    await expect(
      book(member, ids[3], '2027-01-01T10:00:00Z'),
    ).rejects.toMatchObject({ code: '23P01' });
    await book(member, ids[2], '2027-01-01T10:50:00Z');
    await pool.query("UPDATE booking_sessions SET status='cancelled'");
    await book(member, ids[2], '2027-01-01T10:00:00Z');
    const hours = (start: number) =>
      pool.query(
        'INSERT INTO working_hours (professional_id,weekday,start_minute,length_hours,created_by,updated_by) VALUES ($1,1,$2,1,$1,$1)',
        [ids[2], start],
      );
    await hours(540);
    await hours(600);
    await expect(hours(555)).rejects.toMatchObject({ code: '23P01' });
    await expect(hours(541)).rejects.toMatchObject({ code: '23514' });
    expect(
      (await pool.query('SELECT id FROM users LIMIT 1')).rows[0].id[14],
    ).toBe('7');
  } finally {
    await pool.end();
    await container.stop();
  }
});
