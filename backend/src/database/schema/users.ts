import { sql } from 'drizzle-orm';
import { pgTable, text, check } from 'drizzle-orm/pg-core';
import { id, audit } from './columns';
import { role } from './enums';

export const users = pgTable(
  'users',
  {
    id: id(),
    name: text().notNull(),
    email: text().notNull().unique(),
    passwordHash: text().notNull(),
    role: role().notNull(),
    timezone: text().notNull(),
    ...audit(),
  },
  (t) => [check('users_email_lowercase', sql`${t.email} = lower(${t.email})`)],
);
