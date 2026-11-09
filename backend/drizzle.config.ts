import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '../.env' });
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/**/*.ts',
  out: './src/database/migrations',
  dbCredentials: { url: process.env.DATABASE_URL! },
  casing: 'snake_case',
});
