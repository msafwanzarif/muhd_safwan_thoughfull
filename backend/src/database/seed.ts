import { config } from 'dotenv';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { seedData } from './seed-data';

config({ path: ['../.env', '.env'] });
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await seedData(drizzle(pool, { schema, casing: 'snake_case' }));
    console.log('Fictional demo accounts seeded.');
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  console.error('Seed failed');
  process.exitCode = 1;
});
